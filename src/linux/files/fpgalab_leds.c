// SPDX-License-Identifier: GPL-2.0
/*
 * fpgalab_leds: a platform driver for the AXI GPIO of FPGA Lab's lx-gpio design (lesson lx-driver).
 *
 * It binds to this device-tree node (fpgalab-leds.dtsi):
 *     leds@41200000 { compatible = "fpgalab,axi-leds"; reg = <0x41200000 0x10000>; };
 * and gives the device two files in sysfs, /sys/bus/platform/devices/41200000.leds/:
 *     leds   read and write: LED1-LED3 as a number from 0 to 7
 *     keys   read only:      KEY1-KEY5, bit i = 1 while KEYi+1 is pressed
 *
 * Build against the kernel the board runs (Buildroot's output/build/linux-5.1.5): make modules
 */
#include <linux/io.h>
#include <linux/kernel.h>
#include <linux/mod_devicetable.h>
#include <linux/module.h>
#include <linux/of.h>
#include <linux/platform_device.h>

#define GPIO_DATA 0x0  /* channel 1: LED1-LED3 */
#define GPIO_TRI 0x4   /* channel 1 direction: 0 = output */
#define GPIO2_DATA 0x8 /* channel 2: KEY1-KEY5, active low */

struct fpgalab_leds {
	void __iomem *base;
};

static ssize_t leds_show(struct device *dev, struct device_attribute *attr, char *buf)
{
	struct fpgalab_leds *p = dev_get_drvdata(dev);

	return sprintf(buf, "0x%x\n", ioread32(p->base + GPIO_DATA) & 7);
}

static ssize_t leds_store(struct device *dev, struct device_attribute *attr, const char *buf, size_t count)
{
	struct fpgalab_leds *p = dev_get_drvdata(dev);
	unsigned int v;
	int ret = kstrtouint(buf, 0, &v);

	if (ret)
		return ret;
	if (v > 7)
		return -EINVAL;
	iowrite32(v, p->base + GPIO_DATA);
	return count;
}
static DEVICE_ATTR_RW(leds);

static ssize_t keys_show(struct device *dev, struct device_attribute *attr, char *buf)
{
	struct fpgalab_leds *p = dev_get_drvdata(dev);

	return sprintf(buf, "0x%02x\n", ~ioread32(p->base + GPIO2_DATA) & 0x1f);
}
static DEVICE_ATTR_RO(keys);

static struct attribute *fpgalab_attrs[] = {
	&dev_attr_leds.attr,
	&dev_attr_keys.attr,
	NULL,
};
static const struct attribute_group fpgalab_group = {
	.attrs = fpgalab_attrs,
};

static int fpgalab_probe(struct platform_device *pdev)
{
	struct fpgalab_leds *p;
	struct resource *res;

	p = devm_kzalloc(&pdev->dev, sizeof(*p), GFP_KERNEL);
	if (!p)
		return -ENOMEM;
	res = platform_get_resource(pdev, IORESOURCE_MEM, 0);
	p->base = devm_ioremap_resource(&pdev->dev, res);
	if (IS_ERR(p->base))
		return PTR_ERR(p->base);
	platform_set_drvdata(pdev, p);

	iowrite32(0, p->base + GPIO_TRI); /* LED1-LED3 are outputs */
	iowrite32(0, p->base + GPIO_DATA); /* and start dark */
	dev_info(&pdev->dev, "LED1-LED3 and KEY1-KEY5 at %pa\n", &res->start);
	return devm_device_add_group(&pdev->dev, &fpgalab_group);
}

static const struct of_device_id fpgalab_of_match[] = {
	{ .compatible = "fpgalab,axi-leds" },
	{ }
};
MODULE_DEVICE_TABLE(of, fpgalab_of_match);

static struct platform_driver fpgalab_driver = {
	.probe = fpgalab_probe,
	.driver = {
		.name = "fpgalab_leds",
		.of_match_table = fpgalab_of_match,
	},
};
module_platform_driver(fpgalab_driver);

MODULE_DESCRIPTION("FPGA Lab: LED1-LED3 and KEY1-KEY5 of an AXI GPIO");
MODULE_LICENSE("GPL");
