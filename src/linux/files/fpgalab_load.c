// SPDX-License-Identifier: GPL-2.0
/*
 * fpgalab_load: loads a bitstream into the PL from Linux, with the kernel's FPGA manager (lesson lx-fpgamgr).
 *
 *     mkdir -p /lib/firmware && cp running_light.bin /lib/firmware/
 *     insmod fpgalab_load.ko firmware=running_light.bin
 *     rmmod fpgalab_load            (before the next load)
 *
 * The file is a .bin, not a .bit: the raw configuration data with every 32-bit word byte-swapped, which is what the
 * Zynq FPGA manager (drivers/fpga/zynq-fpga.c) expects. The lesson's Vivado project writes it (fpgalab_bit2bin).
 *
 * The mainline kernel 5.1 has the FPGA manager but no file in sysfs to start a load (the Xilinx kernel adds
 * /sys/class/fpga_manager/fpga0/firmware), so this module calls the same in-kernel function, fpga_mgr_load().
 */
#include <linux/err.h>
#include <linux/fpga/fpga-mgr.h>
#include <linux/kernel.h>
#include <linux/module.h>
#include <linux/of.h>
#include <linux/slab.h>

static char *firmware = "fpgalab.bin";
module_param(firmware, charp, 0444);
MODULE_PARM_DESC(firmware, "file in /lib/firmware");

static int __init fpgalab_load_init(void)
{
	struct device_node *np;
	struct fpga_manager *mgr;
	struct fpga_image_info *info;
	int ret;

	/* the Zynq's device configuration unit, which programs the PL */
	np = of_find_compatible_node(NULL, NULL, "xlnx,zynq-devcfg-1.0");
	if (!np)
		return -ENODEV;
	mgr = of_fpga_mgr_get(np);
	of_node_put(np);
	if (IS_ERR(mgr))
		return PTR_ERR(mgr);

	info = fpga_image_info_alloc(&mgr->dev);
	if (!info) {
		fpga_mgr_put(mgr);
		return -ENOMEM;
	}
	info->flags = 0; /* a full reconfiguration of the whole PL */
	info->firmware_name = devm_kstrdup(&mgr->dev, firmware, GFP_KERNEL);

	ret = fpga_mgr_lock(mgr);
	if (!ret) {
		ret = fpga_mgr_load(mgr, info); /* request_firmware() looks in /lib/firmware */
		fpga_mgr_unlock(mgr);
	}
	fpga_image_info_free(info);
	fpga_mgr_put(mgr);
	pr_info("fpgalab_load: %s: %d\n", firmware, ret);
	return ret;
}

static void __exit fpgalab_load_exit(void)
{
}

module_init(fpgalab_load_init);
module_exit(fpgalab_load_exit);
MODULE_DESCRIPTION("FPGA Lab: load a bitstream from /lib/firmware with the FPGA manager");
MODULE_LICENSE("GPL");
