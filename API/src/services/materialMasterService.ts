import prisma from '../config/database';

export type MasterKind = 'point' | 'size';

export interface MaterialMaster {
  id?: number;
  name: string;
  description?: string;
  status?: string;
  in_use_count?: number;
}

/**
 * Points and sizes are identical lookup lists, so one service drives both.
 * The kind decides which table is read and which raw material column blocks a delete.
 */
export class MaterialMasterService {
  constructor(private kind: MasterKind) {}

  private get delegate(): any {
    return this.kind === 'point' ? prisma.materialPoint : prisma.materialSize;
  }

  private usageFilter(id: number) {
    return this.kind === 'point' ? { pointId: id } : { sizeId: id };
  }

  private toMaster(m: any): MaterialMaster {
    return {
      id: m.id,
      name: m.name,
      description: m.description || undefined,
      status: m.status,
      in_use_count: m._count
        ? m._count.rawMaterials + (m._count.products ?? 0)
        : undefined,
    };
  }

  async getAll(): Promise<MaterialMaster[]> {
    const records = await this.delegate.findMany({
      orderBy: { name: 'asc' },
      include: { _count: { select: { rawMaterials: true, products: true } } },
    });

    return records.map((m: any) => this.toMaster(m));
  }

  async getById(id: number): Promise<MaterialMaster | null> {
    const record = await this.delegate.findUnique({ where: { id } });
    if (!record) return null;

    return this.toMaster(record);
  }

  async create(master: MaterialMaster): Promise<MaterialMaster> {
    await this.assertNameIsFree(master.name);

    const created = await this.delegate.create({
      data: {
        name: master.name.trim(),
        description: master.description || null,
        status: master.status || 'active',
      },
    });

    return this.toMaster(created);
  }

  async update(id: number, master: Partial<MaterialMaster>): Promise<MaterialMaster | null> {
    const updateData: any = {};

    if (master.name) {
      await this.assertNameIsFree(master.name, id);
      updateData.name = master.name.trim();
    }
    if (master.description !== undefined) updateData.description = master.description || null;
    if (master.status !== undefined) updateData.status = master.status;

    const updated = await this.delegate.update({
      where: { id },
      data: updateData,
    });

    return this.toMaster(updated);
  }

  async delete(id: number): Promise<boolean> {
    // Products reference points and sizes too, and their foreign keys are Restrict,
    // so both tables have to be clear before the master can go.
    const [rawMaterialCount, productCount] = await Promise.all([
      prisma.rawMaterial.count({ where: this.usageFilter(id) }),
      prisma.product.count({ where: this.usageFilter(id) }),
    ]);

    if (rawMaterialCount + productCount > 0) {
      throw new Error('MASTER_IN_USE');
    }

    try {
      await this.delegate.delete({ where: { id } });
      return true;
    } catch (error) {
      return false;
    }
  }

  // Names are matched case-insensitively so "6MM" cannot slip in alongside "6mm"
  private async assertNameIsFree(name: string, excludeId?: number): Promise<void> {
    const existing = await this.delegate.findFirst({
      where: {
        name: { equals: name.trim(), mode: 'insensitive' },
        ...(excludeId ? { id: { not: excludeId } } : {}),
      },
    });

    if (existing) {
      throw new Error('DUPLICATE_NAME');
    }
  }
}
