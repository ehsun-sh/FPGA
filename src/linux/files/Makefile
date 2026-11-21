# FPGA Lab: the Linux side of the lessons lx-gpio, lx-driver and lx-fpgamgr, built on the PC.
#   make gpio_mem    the /dev/mem program (user space)
#   make modules     fpgalab_leds.ko and fpgalab_load.ko (kernel modules)
#   make dtb         zynq-ebaz4205.dtb with fpgalab-leds.dtsi added (needs dtc and the board's old dtb in this folder)
# BUILDROOT is where you built the Buildroot image of blkf2016/ebaz4205; the modules must be built against that
# exact kernel (Linux 5.1.5).

ifneq ($(KERNELRELEASE),)
obj-m := fpgalab_leds.o fpgalab_load.o
else
BUILDROOT ?= $(HOME)/buildroot-2019.05
KDIR ?= $(BUILDROOT)/output/build/linux-5.1.5
CROSS_COMPILE ?= $(BUILDROOT)/output/host/bin/arm-buildroot-linux-gnueabihf-

all: gpio_mem modules

gpio_mem: gpio_mem.c
	$(CROSS_COMPILE)gcc -O2 -Wall -o $@ $<

modules:
	$(MAKE) -C $(KDIR) M=$(CURDIR) ARCH=arm CROSS_COMPILE=$(CROSS_COMPILE) modules

# decompile the board's dtb, add the node and fclk-enable, compile it again
dtb: zynq-ebaz4205.dtb fpgalab-leds.dtsi
	dtc -I dtb -O dts -o board.dts zynq-ebaz4205.dtb
	cat board.dts fpgalab-leds.dtsi > fpgalab.dts
	dtc -I dts -O dtb -o zynq-ebaz4205.dtb fpgalab.dts

clean:
	rm -f gpio_mem board.dts fpgalab.dts
	$(MAKE) -C $(KDIR) M=$(CURDIR) ARCH=arm clean

.PHONY: all modules dtb clean
endif
