import prisma from '../config/database';

export interface Client {
  id?: number;
  name: string;
  company_name?: string;
  email?: string;
  phone?: string;
  address?: string;
  status?: string;
}

export class ClientService {
  async getAllClients(): Promise<Client[]> {
    const clients = await prisma.client.findMany({
      orderBy: { createdAt: 'desc' },
    });

    return clients.map(c => ({
      id: c.id,
      name: c.name,
      company_name: c.companyName || undefined,
      email: c.email || undefined,
      phone: c.phone || undefined,
      address: c.address || undefined,
      status: c.status,
    }));
  }

  async getClientById(id: number): Promise<Client | null> {
    const client = await prisma.client.findUnique({
      where: { id },
    });

    if (!client) return null;

    return {
      id: client.id,
      name: client.name,
      company_name: client.companyName || undefined,
      email: client.email || undefined,
      phone: client.phone || undefined,
      address: client.address || undefined,
      status: client.status,
    };
  }

  async createClient(client: Client): Promise<Client> {
    const created = await prisma.client.create({
      data: {
        name: client.name,
        companyName: client.company_name || null,
        email: client.email || null,
        phone: client.phone || null,
        address: client.address || null,
        status: client.status || 'active',
      },
    });

    return {
      id: created.id,
      name: created.name,
      company_name: created.companyName || undefined,
      email: created.email || undefined,
      phone: created.phone || undefined,
      address: created.address || undefined,
      status: created.status,
    };
  }

  async updateClient(id: number, client: Partial<Client>): Promise<Client | null> {
    const updateData: any = {};

    if (client.name) updateData.name = client.name;
    if (client.company_name !== undefined) updateData.companyName = client.company_name || null;
    if (client.email !== undefined) updateData.email = client.email || null;
    if (client.phone !== undefined) updateData.phone = client.phone || null;
    if (client.address !== undefined) updateData.address = client.address || null;
    if (client.status !== undefined) updateData.status = client.status;

    const updated = await prisma.client.update({
      where: { id },
      data: updateData,
    });

    return {
      id: updated.id,
      name: updated.name,
      company_name: updated.companyName || undefined,
      email: updated.email || undefined,
      phone: updated.phone || undefined,
      address: updated.address || undefined,
      status: updated.status,
    };
  }

  async deleteClient(id: number): Promise<boolean> {
    try {
      await prisma.client.delete({
        where: { id },
      });
      return true;
    } catch (error) {
      return false;
    }
  }
}



