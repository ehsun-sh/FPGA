/* gpio_mem.c: LED1-LED3 and KEY1-KEY5 of FPGA Lab's AXI GPIO (lesson lx-gpio), from user space through /dev/mem.
 *
 *   ./gpio_mem leds 5    LED1 and LED3 on (a number from 0 to 7)
 *   ./gpio_mem keys      which keys are pressed
 *   ./gpio_mem mirror    KEY1-KEY3 drive LED1-LED3 until Ctrl+C
 *
 * The AXI GPIO sits at 0x41200000 on the PS's M_AXI_GP0 port. Channel 1 (GPIO_DATA) is three outputs to LED1-LED3,
 * channel 2 (GPIO2_DATA) five inputs from KEY1-KEY5, which are active low: a bit reads 0 while its key is pressed.
 *
 * Build on the PC (Buildroot's cross compiler):  make gpio_mem
 *   or:  arm-buildroot-linux-gnueabihf-gcc -O2 -Wall -o gpio_mem gpio_mem.c
 * Copy:  scp gpio_mem root@192.168.100.1:/root/
 *
 * Only run it with the lx-gpio design in the PL: a read from an address with nothing behind it never completes,
 * and the board hangs until you power it off.
 */
#include <fcntl.h>
#include <signal.h>
#include <stdint.h>
#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <sys/mman.h>
#include <unistd.h>

#define AXI_GPIO_BASE 0x41200000u
#define MAP_SIZE 0x10000u
#define GPIO_DATA 0x0  /* channel 1: LED1-LED3 (outputs) */
#define GPIO2_DATA 0x8 /* channel 2: KEY1-KEY5 (inputs, active low) */

static volatile sig_atomic_t running = 1;
static void stop(int sig)
{
	(void)sig;
	running = 0;
}

static void print_keys(uint32_t raw)
{
	uint32_t pressed = ~raw & 0x1f;
	printf("keys pressed: 0x%02x  [", (unsigned)pressed);
	for (int i = 0; i < 5; i++) {
		if (pressed >> i & 1)
			printf("KEY%d", i + 1);
		else
			printf("----");
		if (i < 4)
			putchar(' ');
	}
	printf("]\n");
	fflush(stdout);
}

int main(int argc, char **argv)
{
	if (argc < 2) {
		fprintf(stderr, "usage: gpio_mem leds VALUE | keys | mirror\n");
		return 1;
	}
	int fd = open("/dev/mem", O_RDWR | O_SYNC);
	if (fd < 0) {
		perror("open /dev/mem");
		return 1;
	}
	volatile uint32_t *gpio = mmap(NULL, MAP_SIZE, PROT_READ | PROT_WRITE, MAP_SHARED, fd, AXI_GPIO_BASE);
	if (gpio == MAP_FAILED) {
		perror("mmap");
		close(fd);
		return 1;
	}

	int ret = 0;
	if (!strcmp(argv[1], "leds") && argc > 2) {
		uint32_t v = strtoul(argv[2], NULL, 0) & 7;
		gpio[GPIO_DATA / 4] = v;
		printf("LED1-LED3 <- 0x%x\n", (unsigned)v);
	} else if (!strcmp(argv[1], "keys")) {
		print_keys(gpio[GPIO2_DATA / 4]);
	} else if (!strcmp(argv[1], "mirror")) {
		signal(SIGINT, stop);
		printf("mirroring KEY1-KEY3 onto LED1-LED3, Ctrl+C to stop\n");
		uint32_t last = 0xffffffffu;
		while (running) {
			uint32_t raw = gpio[GPIO2_DATA / 4];
			uint32_t keys = ~raw & 7;
			gpio[GPIO_DATA / 4] = keys;
			if (keys != last) {
				if (last != 0xffffffffu)
					print_keys(raw);
				last = keys;
			}
			usleep(10000);
		}
		gpio[GPIO_DATA / 4] = 0;
	} else {
		fprintf(stderr, "usage: gpio_mem leds VALUE | keys | mirror\n");
		ret = 1;
	}
	munmap((void *)gpio, MAP_SIZE);
	close(fd);
	return ret;
}
