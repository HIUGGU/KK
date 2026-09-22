import prisma from '../config/database';

export interface BankAccount {
  id?: number;
  account_name: string;
  account_number: string;
  bank_name: string;
  ifsc_code?: string;
  branch?: string;
  account_type?: string;
  status?: string;
}

export class BankAccountService {
  async getAllBankAccounts(): Promise<BankAccount[]> {
    const accounts = await prisma.bankAccount.findMany({
      orderBy: { createdAt: 'desc' },
    });

    return accounts.map(a => ({
      id: a.id,
      account_name: a.accountName,
      account_number: a.accountNumber,
      bank_name: a.bankName,
      ifsc_code: a.ifscCode || undefined,
      branch: a.branch || undefined,
      account_type: a.accountType,
      status: a.status,
    }));
  }

  async getBankAccountById(id: number): Promise<BankAccount | null> {
    const account = await prisma.bankAccount.findUnique({
      where: { id },
    });

    if (!account) return null;

    return {
      id: account.id,
      account_name: account.accountName,
      account_number: account.accountNumber,
      bank_name: account.bankName,
      ifsc_code: account.ifscCode || undefined,
      branch: account.branch || undefined,
      account_type: account.accountType,
      status: account.status,
    };
  }

  async createBankAccount(account: BankAccount): Promise<BankAccount> {
    const created = await prisma.bankAccount.create({
      data: {
        accountName: account.account_name,
        accountNumber: account.account_number,
        bankName: account.bank_name,
        ifscCode: account.ifsc_code || null,
        branch: account.branch || null,
        accountType: account.account_type || 'savings',
        status: account.status || 'active',
      },
    });

    return {
      id: created.id,
      account_name: created.accountName,
      account_number: created.accountNumber,
      bank_name: created.bankName,
      ifsc_code: created.ifscCode || undefined,
      branch: created.branch || undefined,
      account_type: created.accountType,
      status: created.status,
    };
  }

  async updateBankAccount(id: number, account: Partial<BankAccount>): Promise<BankAccount | null> {
    const updateData: any = {};

    if (account.account_name) updateData.accountName = account.account_name;
    if (account.account_number) updateData.accountNumber = account.account_number;
    if (account.bank_name) updateData.bankName = account.bank_name;
    if (account.ifsc_code !== undefined) updateData.ifscCode = account.ifsc_code || null;
    if (account.branch !== undefined) updateData.branch = account.branch || null;
    if (account.account_type !== undefined) updateData.accountType = account.account_type;
    if (account.status !== undefined) updateData.status = account.status;

    const updated = await prisma.bankAccount.update({
      where: { id },
      data: updateData,
    });

    return {
      id: updated.id,
      account_name: updated.accountName,
      account_number: updated.accountNumber,
      bank_name: updated.bankName,
      ifsc_code: updated.ifscCode || undefined,
      branch: updated.branch || undefined,
      account_type: updated.accountType,
      status: updated.status,
    };
  }

  async deleteBankAccount(id: number): Promise<boolean> {
    try {
      await prisma.bankAccount.delete({
        where: { id },
      });
      return true;
    } catch (error) {
      return false;
    }
  }
}



