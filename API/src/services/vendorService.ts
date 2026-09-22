import prisma from '../config/database';

export interface Vendor {
  id?: number;
  name: string;
  company_name?: string;
  phone?: string;
  email?: string;
  address?: string;
  /** material or plasma - the two are kept as separate lists */
  vendor_type?: string;
  status?: string;
}

export class VendorService {
  private toVendor(v: any): Vendor {
    return {
      id: v.id,
      name: v.name,
      company_name: v.companyName || undefined,
      phone: v.phone || undefined,
      email: v.email || undefined,
      address: v.address || undefined,
      vendor_type: v.vendorType,
      status: v.status,
    };
  }

  /** Every vendor, or just the ones of one type when `type` is given. */
  async getAllVendors(type?: string): Promise<Vendor[]> {
    const vendors = await prisma.vendor.findMany({
      where: type ? { vendorType: type } : {},
      orderBy: { name: 'asc' },
    });

    return vendors.map(v => this.toVendor(v));
  }

  async getVendorById(id: number): Promise<Vendor | null> {
    const vendor = await prisma.vendor.findUnique({
      where: { id },
    });

    if (!vendor) return null;

    return this.toVendor(vendor);
  }

  async createVendor(vendor: Vendor): Promise<Vendor> {
    const created = await prisma.vendor.create({
      data: {
        name: vendor.name,
        companyName: vendor.company_name || null,
        phone: vendor.phone || null,
        email: vendor.email || null,
        address: vendor.address || null,
        vendorType: vendor.vendor_type === 'plasma' ? 'plasma' : 'material',
        status: vendor.status || 'active',
      },
    });

    return this.toVendor(created);
  }

  async updateVendor(id: number, vendor: Partial<Vendor>): Promise<Vendor | null> {
    const updateData: any = {};

    if (vendor.name) updateData.name = vendor.name;
    if (vendor.company_name !== undefined) updateData.companyName = vendor.company_name || null;
    if (vendor.phone !== undefined) updateData.phone = vendor.phone || null;
    if (vendor.email !== undefined) updateData.email = vendor.email || null;
    if (vendor.address !== undefined) updateData.address = vendor.address || null;
    if (vendor.vendor_type !== undefined) {
      updateData.vendorType = vendor.vendor_type === 'plasma' ? 'plasma' : 'material';
    }
    if (vendor.status !== undefined) updateData.status = vendor.status;

    const updated = await prisma.vendor.update({
      where: { id },
      data: updateData,
    });

    return this.toVendor(updated);
  }

  async deleteVendor(id: number): Promise<boolean> {
    const [entryCount, jobCount] = await Promise.all([
      prisma.rawMaterialEntry.count({ where: { vendorId: id } }),
      prisma.processJob.count({ where: { vendorId: id } }),
    ]);

    if (entryCount > 0) {
      throw new Error('VENDOR_IN_USE');
    }
    if (jobCount > 0) {
      throw new Error('VENDOR_HAS_JOBS');
    }

    try {
      await prisma.vendor.delete({
        where: { id },
      });
      return true;
    } catch (error) {
      return false;
    }
  }
}
