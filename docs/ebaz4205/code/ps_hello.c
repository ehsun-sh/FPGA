/* z-ps-hello: the first program on the ARM core of the EBAZ4205 (Vitis, "Empty Application (C)").
 * stdout is UART1 on MIO 24/25 (header J7, 115200 8N1). EMIO GPIO 54 and 55 drive LED_R and LED_G
 * when the block design routes GPIO_O[1:0] to them (lesson z-emio).
 * Vitis 2023.2 and later (system-device-tree flow): use XGpioPs_LookupConfig(XPAR_XGPIOPS_0_BASEADDR). */
#include <stdio.h>
#include "xparameters.h"
#include "xgpiops.h"
#include "sleep.h"

#define LED_R_PIN 54   /* first EMIO GPIO = bank 2, bit 0 */
#define LED_G_PIN 55

int main(void)
{
    XGpioPs gpio;
    XGpioPs_Config *cfg = XGpioPs_LookupConfig(XPAR_XGPIOPS_0_DEVICE_ID);
    XGpioPs_CfgInitialize(&gpio, cfg, cfg->BaseAddr);
    for (int pin = LED_R_PIN; pin <= LED_G_PIN; pin++) {
        XGpioPs_SetDirectionPin(&gpio, pin, 1);
        XGpioPs_SetOutputEnablePin(&gpio, pin, 1);
    }

    printf("Hello from the Zynq PS on the EBAZ4205!\r\n");
    for (unsigned n = 0;; n++) {
        XGpioPs_WritePin(&gpio, LED_R_PIN, n & 1);
        XGpioPs_WritePin(&gpio, LED_G_PIN, !(n & 1));
        printf("tick %u\r\n", n);
        sleep(1);
    }
}
