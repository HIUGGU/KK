import { Prisma } from '@prisma/client';
import prisma from '../config/database';

/**
 * Cutting turns raw material lots into counted finished products.
 *
 * A lot is taken whole: the raw material model has no "remaining weight", so a
 * lot is either cut or it is not. Feeding one into a cutting moves it to
 * `consumed`; removing it from the cutting puts it back to `in_stock`.
 */

/** Statuses a lot can be picked from when starting a cutting. */
const CUTTABLE_STATUSES = ['in_stock', 'in_use'];

export interface CuttingInputLine {
  id?: number;
  raw_material_id: number;
  weight_used?: number;
  cost_used?: number;
  // Resolved from the lot for display; never written back
  point_id?: number;
  point_name?: string;
  size_id?: number;
  size_name?: string;
  rate_per_kg?: number;
  vendor_name?: string;
  entry_number?: string;
  received_date?: string;
}

export interface CuttingOutputLine {
  id?: number;
  product_id: number;
  product_name?: string;
  unit?: string;
  quantity: number;
  notes?: string;
}

export interface Cutting {
  id?: number;
  cutting_number?: string;
  cutting_date: string;
  notes?: string;
  total_input_weight?: number;
  total_input_cost?: number;
  total_output_count?: number;
  /** Input cost spread over the pieces produced. Undefined when nothing came out. */
  cost_per_piece?: number;
  input_count?: number;
  output_line_count?: number;
  inputs: CuttingInputLine[];
  outputs: CuttingOutputLine[];
}

/** Per-product produced/ordered/in-stock counts. */
export interface ProductStock {
  product_id: number;
  product_name: string;
  unit?: string;
  produced: number;
  ordered: number;
  in_stock: number;
}

/** A raw material lot that is free to be cut. */
export interface AvailableMaterial {
  id: number;
  entry_id: number;
  entry_number: string;
  vendor_id: number;
  vendor_name?: string;
  received_date: string;
  point_id: number;
  point_name?: string;
  size_id: number;
  size_name?: string;
  weight: number;
  rate_per_kg: number;
  total_cost: number;
  status: string;
}

export interface CuttingSummary {
  total_cuttings: number;
  total_input_weight: number;
  total_input_cost: number;
  total_output_count: number;
  /** Weighted across every cutting, not an average of the per-cutting figures. */
  avg_cost_per_piece: number;
  available_lots: number;
  available_weight: number;
  /** Pieces sold across every order, regardless of product. */
  total_ordered_count: number;
  /** Pieces cut but not yet ordered: total_output_count - total_ordered_count. */
  in_stock_count: number;
}

const cuttingNumber = (id: number) => `CUT-${String(id).padStart(4, '0')}`;
const entryNumber = (id: number) => `RM-${String(id).padStart(4, '0')}`;

const round2 = (value: number) => Math.round(value * 100) / 100;

export class CuttingService {
  private materialInclude = {
    point: true,
    size: true,
    entry: { include: { vendor: true } },
  };

  private cuttingInclude = {
    inputs: {
      include: { rawMaterial: { include: this.materialInclude } },
      orderBy: { id: 'asc' as const },
    },
    outputs: {
      include: { product: true },
      orderBy: { id: 'asc' as const },
    },
  };

  private toInput(input: any): CuttingInputLine {
    const material = input.rawMaterial;
    const entry = material ? material.entry : undefined;
    return {
      id: input.id,
      raw_material_id: input.rawMaterialId,
      weight_used: Number(input.weightUsed),
      cost_used: Number(input.costUsed),
      point_id: material ? material.pointId : undefined,
      point_name: material && material.point ? material.point.name : undefined,
      size_id: material ? material.sizeId : undefined,
      size_name: material && material.size ? material.size.name : undefined,
      rate_per_kg: material ? Number(material.ratePerKg) : undefined,
      vendor_name: entry && entry.vendor ? entry.vendor.name : undefined,
      entry_number: entry ? entryNumber(entry.id) : undefined,
      received_date: entry ? entry.receivedDate.toISOString().split('T')[0] : undefined,
    };
  }

  private toOutput(output: any): CuttingOutputLine {
    return {
      id: output.id,
      product_id: output.productId,
      product_name: output.product ? output.product.name : undefined,
      unit: output.product ? output.product.unit : undefined,
      quantity: Number(output.quantity),
      notes: output.notes || undefined,
    };
  }

  private toCutting(c: any): Cutting {
    const inputs = (c.inputs || []).map((input: any) => this.toInput(input));
    const outputs = (c.outputs || []).map((output: any) => this.toOutput(output));
    const inputCost = Number(c.totalInputCost);
    const outputCount = Number(c.totalOutputCount);

    return {
      id: c.id,
      cutting_number: cuttingNumber(c.id),
      cutting_date: c.cuttingDate.toISOString().split('T')[0],
      notes: c.notes || undefined,
      total_input_weight: Number(c.totalInputWeight),
      total_input_cost: inputCost,
      total_output_count: outputCount,
      cost_per_piece: outputCount > 0 ? round2(inputCost / outputCount) : undefined,
      input_count: inputs.length,
      output_line_count: outputs.length,
      inputs,
      outputs,
    };
  }

  private toAvailable(m: any): AvailableMaterial {
    return {
      id: m.id,
      entry_id: m.entryId,
      entry_number: entryNumber(m.entryId),
      vendor_id: m.entry.vendorId,
      vendor_name: m.entry.vendor ? m.entry.vendor.name : undefined,
      received_date: m.entry.receivedDate.toISOString().split('T')[0],
      point_id: m.pointId,
      point_name: m.point ? m.point.name : undefined,
      size_id: m.sizeId,
      size_name: m.size ? m.size.name : undefined,
      weight: Number(m.weight),
      rate_per_kg: Number(m.ratePerKg),
      total_cost: Number(m.totalCost),
      status: m.status,
    };
  }

  /** Cuttings, newest first. */
  async getAll(fromDate?: string, toDate?: string): Promise<Cutting[]> {
    const where: any = {};
    if (fromDate || toDate) {
      where.cuttingDate = {};
      if (fromDate) where.cuttingDate.gte = new Date(fromDate);
      if (toDate) where.cuttingDate.lte = new Date(toDate);
    }

    const cuttings = await prisma.cutting.findMany({
      where,
      include: this.cuttingInclude,
      orderBy: [{ cuttingDate: 'desc' }, { id: 'desc' }],
    });

    return cuttings.map(c => this.toCutting(c));
  }

  async getById(id: number): Promise<Cutting | null> {
    const cutting = await prisma.cutting.findUnique({
      where: { id },
      include: this.cuttingInclude,
    });

    return cutting ? this.toCutting(cutting) : null;
  }

  /**
   * Lots that can still be cut: in stock or in use, and not already fed into a
   * cutting. `forCuttingId` also keeps the lots that cutting already holds, so
   * editing one shows its own selection alongside what is free.
   */
  async getAvailableMaterials(forCuttingId?: number): Promise<AvailableMaterial[]> {
    const materials = await prisma.rawMaterial.findMany({
      where: {
        OR: [
          {
            status: { in: CUTTABLE_STATUSES },
            cuttingInputs: { none: {} },
          },
          ...(forCuttingId ? [{ cuttingInputs: { some: { cuttingId: forCuttingId } } }] : []),
        ],
      },
      include: this.materialInclude,
      orderBy: [{ entryId: 'desc' }, { id: 'asc' }],
    });

    return materials.map(m => this.toAvailable(m));
  }

  async create(cutting: Cutting): Promise<Cutting> {
    const materialIds = this.materialIds(cutting);
    const outputs = this.validOutputs(cutting);

    const created = await prisma.$transaction(async tx => {
      const materials = await this.loadCuttableMaterials(tx, materialIds);
      this.assertSameSpec(materials);
      const totals = this.totalsFor(materials, outputs);

      const row = await tx.cutting.create({
        data: {
          cuttingDate: new Date(cutting.cutting_date),
          notes: cutting.notes || null,
          totalInputWeight: totals.weight,
          totalInputCost: totals.cost,
          totalOutputCount: totals.count,
          inputs: {
            create: materials.map(m => ({
              rawMaterialId: m.id,
              weightUsed: Number(m.weight),
              costUsed: Number(m.totalCost),
            })),
          },
          outputs: { create: outputs.map(o => this.outputCreateData(o)) },
        },
      });

      await this.consume(tx, materialIds, cuttingNumber(row.id));

      return row;
    });

    return (await this.getById(created.id)) as Cutting;
  }

  /**
   * Replaces a cutting's lots and outputs. Lots dropped from the selection go
   * back to stock; newly picked ones are consumed.
   */
  async update(id: number, cutting: Cutting): Promise<Cutting | null> {
    const existing = await prisma.cutting.findUnique({
      where: { id },
      include: { inputs: true },
    });
    if (!existing) return null;

    const materialIds = this.materialIds(cutting);
    const outputs = this.validOutputs(cutting);
    const previousIds = existing.inputs.map(input => input.rawMaterialId);
    const addedIds = materialIds.filter(materialId => !previousIds.includes(materialId));
    const removedIds = previousIds.filter(materialId => !materialIds.includes(materialId));

    await prisma.$transaction(async tx => {
      // Free the dropped lots first, so a lot moved between cuttings in one edit
      // does not trip the "already cut" check below
      await tx.cuttingInput.deleteMany({
        where: { cuttingId: id, rawMaterialId: { in: removedIds } },
      });

      const materials = await this.loadCuttableMaterials(tx, materialIds, id);
      // Skip when nothing new joined: a legacy cutting from before this rule
      // existed can still have its date, notes or output counts edited.
      if (addedIds.length > 0) this.assertSameSpec(materials);
      const totals = this.totalsFor(materials, outputs);

      await tx.cuttingOutput.deleteMany({ where: { cuttingId: id } });

      await tx.cutting.update({
        where: { id },
        data: {
          cuttingDate: new Date(cutting.cutting_date),
          notes: cutting.notes || null,
          totalInputWeight: totals.weight,
          totalInputCost: totals.cost,
          totalOutputCount: totals.count,
          inputs: {
            create: materials
              .filter(m => addedIds.includes(m.id))
              .map(m => ({
                rawMaterialId: m.id,
                weightUsed: Number(m.weight),
                costUsed: Number(m.totalCost),
              })),
          },
          outputs: { create: outputs.map(o => this.outputCreateData(o)) },
        },
      });

      await this.consume(tx, addedIds, cuttingNumber(id));
      await this.release(tx, removedIds, cuttingNumber(id));
    });

    return this.getById(id);
  }

  /** Removing a cutting puts every lot it held back into stock. */
  async remove(id: number): Promise<boolean> {
    const existing = await prisma.cutting.findUnique({
      where: { id },
      include: { inputs: true },
    });
    if (!existing) return false;

    const materialIds = existing.inputs.map(input => input.rawMaterialId);

    await prisma.$transaction(async tx => {
      await tx.cutting.delete({ where: { id } });
      await this.release(tx, materialIds, cuttingNumber(id));
    });

    return true;
  }

  async getSummary(): Promise<CuttingSummary> {
    const [cuttings, available, orderedAgg] = await Promise.all([
      prisma.cutting.findMany(),
      prisma.rawMaterial.findMany({
        where: { status: { in: CUTTABLE_STATUSES }, cuttingInputs: { none: {} } },
      }),
      prisma.orderItem.aggregate({ _sum: { quantity: true } }),
    ]);

    const totalInputWeight = cuttings.reduce((sum, c) => sum + Number(c.totalInputWeight), 0);
    const totalInputCost = cuttings.reduce((sum, c) => sum + Number(c.totalInputCost), 0);
    const totalOutputCount = cuttings.reduce((sum, c) => sum + Number(c.totalOutputCount), 0);
    const totalOrderedCount = Number(orderedAgg._sum.quantity || 0);

    return {
      total_cuttings: cuttings.length,
      total_input_weight: totalInputWeight,
      total_input_cost: round2(totalInputCost),
      total_output_count: totalOutputCount,
      avg_cost_per_piece: totalOutputCount > 0 ? round2(totalInputCost / totalOutputCount) : 0,
      available_lots: available.length,
      available_weight: available.reduce((sum, m) => sum + Number(m.weight), 0),
      total_ordered_count: totalOrderedCount,
      in_stock_count: totalOutputCount - totalOrderedCount,
    };
  }

  /**
   * Every product that has ever been cut, with how many pieces came out of
   * cuttings, how many have been ordered, and what that leaves in stock.
   * Products never cut are left out - there is nothing to reconcile for them.
   */
  async getProductStock(): Promise<ProductStock[]> {
    const [produced, ordered] = await Promise.all([
      prisma.cuttingOutput.groupBy({ by: ['productId'], _sum: { quantity: true } }),
      prisma.orderItem.groupBy({ by: ['productId'], _sum: { quantity: true } }),
    ]);

    const productIds = produced.map(row => row.productId);
    const products = await prisma.product.findMany({ where: { id: { in: productIds } } });
    const productById = new Map(products.map(p => [p.id, p]));
    const orderedByProduct = new Map(ordered.map(row => [row.productId, Number(row._sum.quantity || 0)]));

    return produced
      .map(row => {
        const product = productById.get(row.productId);
        const producedCount = Number(row._sum.quantity || 0);
        const orderedCount = orderedByProduct.get(row.productId) || 0;
        return {
          product_id: row.productId,
          product_name: product ? product.name : `#${row.productId}`,
          unit: product ? product.unit : undefined,
          produced: producedCount,
          ordered: orderedCount,
          in_stock: producedCount - orderedCount,
        };
      })
      .sort((a, b) => a.product_name.localeCompare(b.product_name));
  }

  /** De-duplicated lot ids from the payload. Throws when nothing was picked. */
  private materialIds(cutting: Cutting): number[] {
    const ids = (cutting.inputs || [])
      .map(input => Number(input.raw_material_id))
      .filter(id => Number.isInteger(id) && id > 0);
    const unique = Array.from(new Set(ids));

    if (unique.length === 0) throw new Error('NO_INPUTS');
    return unique;
  }

  /** Output lines worth storing: a real product and a count above zero. */
  private validOutputs(cutting: Cutting): CuttingOutputLine[] {
    const outputs = (cutting.outputs || []).filter(
      output => Number(output.product_id) > 0 && Number(output.quantity) > 0
    );

    if (outputs.length === 0) throw new Error('NO_OUTPUTS');

    const productIds = outputs.map(output => Number(output.product_id));
    if (new Set(productIds).size !== productIds.length) {
      throw new Error('DUPLICATE_PRODUCT');
    }

    return outputs;
  }

  private outputCreateData(output: CuttingOutputLine) {
    return {
      productId: Number(output.product_id),
      quantity: Number(output.quantity),
      notes: output.notes || null,
    };
  }

  /**
   * Loads the picked lots and refuses the save unless every one of them exists,
   * is in a cuttable status and is not already spoken for by another cutting.
   */
  private async loadCuttableMaterials(
    tx: Prisma.TransactionClient,
    materialIds: number[],
    forCuttingId?: number
  ) {
    const materials = await tx.rawMaterial.findMany({
      where: { id: { in: materialIds } },
      include: { cuttingInputs: true },
    });

    if (materials.length !== materialIds.length) {
      throw new Error('MATERIAL_NOT_FOUND');
    }

    for (const material of materials) {
      const heldElsewhere = material.cuttingInputs.some(
        input => input.cuttingId !== forCuttingId
      );
      if (heldElsewhere) throw new Error('MATERIAL_ALREADY_CUT');

      const ownedHere = material.cuttingInputs.length > 0;
      // A lot this cutting already holds is `consumed` by that very fact
      if (!ownedHere && !CUTTABLE_STATUSES.includes(material.status)) {
        throw new Error('MATERIAL_NOT_AVAILABLE');
      }
    }

    return materials;
  }

  /**
   * A cutting works one point/size only, so every lot must match the first.
   * Callers decide which materials to check: a fresh cutting checks them all,
   * an edit checks only when a new line is actually joining, so a legacy
   * cutting that predates this rule can still be edited otherwise untouched.
   */
  private assertSameSpec(materials: { pointId: number; sizeId: number }[]): void {
    const first = materials[0];
    if (!first) return;
    const mixed = materials.some(m => m.pointId !== first.pointId || m.sizeId !== first.sizeId);
    if (mixed) throw new Error('MIXED_SPEC');
  }

  private totalsFor(
    materials: { weight: Prisma.Decimal; totalCost: Prisma.Decimal }[],
    outputs: CuttingOutputLine[]
  ) {
    return {
      weight: materials.reduce((sum, m) => sum + Number(m.weight), 0),
      cost: round2(materials.reduce((sum, m) => sum + Number(m.totalCost), 0)),
      count: outputs.reduce((sum, output) => sum + Number(output.quantity), 0),
    };
  }

  private async consume(tx: Prisma.TransactionClient, materialIds: number[], reference: string) {
    await this.moveStatus(tx, materialIds, 'consumed', `Cut in ${reference}`);
  }

  private async release(tx: Prisma.TransactionClient, materialIds: number[], reference: string) {
    await this.moveStatus(tx, materialIds, 'in_stock', `Returned to stock from ${reference}`);
  }

  private async moveStatus(
    tx: Prisma.TransactionClient,
    materialIds: number[],
    status: string,
    notes: string
  ) {
    if (materialIds.length === 0) return;

    await tx.rawMaterial.updateMany({
      where: { id: { in: materialIds } },
      data: { status },
    });
    await tx.rawMaterialStatusLog.createMany({
      data: materialIds.map(materialId => ({ rawMaterialId: materialId, status, notes })),
    });
  }
}
