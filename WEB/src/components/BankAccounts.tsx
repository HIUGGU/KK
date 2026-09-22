import { useState, useEffect } from 'react';
import { apiClient } from '../api/client';
import './BankAccounts.css';
import { notify, confirmDialog } from '../utils/notify';

interface BankAccount {
  id?: number;
  account_name: string;
  account_number: string;
  bank_name: string;
  ifsc_code?: string;
  branch?: string;
  account_type?: string;
  status?: string;
}

export default function BankAccounts() {
  const [accounts, setAccounts] = useState<BankAccount[]>([]);
  const [showModal, setShowModal] = useState(false);
  const [editingAccount, setEditingAccount] = useState<BankAccount | null>(null);
  const [formData, setFormData] = useState<BankAccount>({
    account_name: '',
    account_number: '',
    bank_name: '',
    ifsc_code: '',
    branch: '',
    account_type: 'savings',
    status: 'active',
  });

  useEffect(() => {
    loadAccounts();
  }, []);

  const loadAccounts = async () => {
    try {
      const data = await apiClient.getAllBankAccounts();
      setAccounts(data);
    } catch (error) {
      console.error('Failed to load bank accounts:', error);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (editingAccount?.id) {
        await apiClient.updateBankAccount(editingAccount.id, formData);
      } else {
        await apiClient.createBankAccount(formData);
      }
      setShowModal(false);
      setEditingAccount(null);
      resetForm();
      loadAccounts();
    } catch (error: any) {
      console.error('Failed to save bank account:', error);
      notify.error(error.message || 'Failed to save bank account. Please try again.');
    }
  };

  const handleEdit = (account: BankAccount) => {
    setEditingAccount(account);
    setFormData(account);
    setShowModal(true);
  };

  const handleDelete = async (id: number) => {
    if (await confirmDialog('Are you sure you want to delete this bank account?', { confirmLabel: 'Delete', danger: true })) {
      try {
        await apiClient.deleteBankAccount(id);
        loadAccounts();
      } catch (error: any) {
        console.error('Failed to delete bank account:', error);
        notify.error(error.message || 'Failed to delete bank account. Please try again.');
      }
    }
  };

  const resetForm = () => {
    setFormData({
      account_name: '',
      account_number: '',
      bank_name: '',
      ifsc_code: '',
      branch: '',
      account_type: 'savings',
      status: 'active',
    });
  };

  return (
    <div className="bank-accounts">
      <div className="page-header">
        <h1>Bank Accounts</h1>
        <button className="btn-primary" onClick={() => { setShowModal(true); setEditingAccount(null); resetForm(); }}>
          + Add Bank Account
        </button>
      </div>

      <div className="table-container">
        <table className="bank-accounts-table">
          <thead>
            <tr>
              <th>Account Name</th>
              <th>Bank Name</th>
              <th>Account Number</th>
              <th>IFSC Code</th>
              <th>Branch</th>
              <th>Account Type</th>
              <th>Status</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {accounts.length === 0 ? (
              <tr>
                <td colSpan={8} style={{ textAlign: 'center', padding: '40px' }}>
                  No bank accounts found. Add your first bank account!
                </td>
              </tr>
            ) : (
              accounts.map((account) => (
                <tr key={account.id}>
                  <td>{account.account_name}</td>
                  <td>{account.bank_name}</td>
                  <td>{account.account_number}</td>
                  <td>{account.ifsc_code || '-'}</td>
                  <td>{account.branch || '-'}</td>
                  <td>
                    <span className="account-type-badge">
                      {account.account_type || 'savings'}
                    </span>
                  </td>
                  <td>
                    <span className={`status-badge ${account.status}`}>
                      {account.status || 'active'}
                    </span>
                  </td>
                  <td>
                    <button className="btn-edit" onClick={() => handleEdit(account)}>
                      Edit
                    </button>
                    <button className="btn-delete" onClick={() => handleDelete(account.id!)}>
                      Delete
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {showModal && (
        <div className="modal-overlay" onClick={() => { setShowModal(false); setEditingAccount(null); resetForm(); }}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <h2>{editingAccount ? 'Edit Bank Account' : 'Add Bank Account'}</h2>
            <form onSubmit={handleSubmit}>
              <div className="form-row">
                <div className="form-group">
                  <label>Account Name *</label>
                  <input
                    type="text"
                    value={formData.account_name}
                    onChange={(e) => setFormData({ ...formData, account_name: e.target.value })}
                    required
                  />
                </div>
                <div className="form-group">
                  <label>Bank Name *</label>
                  <input
                    type="text"
                    value={formData.bank_name}
                    onChange={(e) => setFormData({ ...formData, bank_name: e.target.value })}
                    required
                  />
                </div>
              </div>
              <div className="form-row">
                <div className="form-group">
                  <label>Account Number *</label>
                  <input
                    type="text"
                    value={formData.account_number}
                    onChange={(e) => setFormData({ ...formData, account_number: e.target.value })}
                    required
                  />
                </div>
                <div className="form-group">
                  <label>IFSC Code</label>
                  <input
                    type="text"
                    value={formData.ifsc_code}
                    onChange={(e) => setFormData({ ...formData, ifsc_code: e.target.value })}
                  />
                </div>
              </div>
              <div className="form-row">
                <div className="form-group">
                  <label>Branch</label>
                  <input
                    type="text"
                    value={formData.branch}
                    onChange={(e) => setFormData({ ...formData, branch: e.target.value })}
                  />
                </div>
                <div className="form-group">
                  <label>Account Type *</label>
                  <select
                    value={formData.account_type}
                    onChange={(e) => setFormData({ ...formData, account_type: e.target.value })}
                    required
                  >
                    <option value="savings">Savings</option>
                    <option value="current">Current</option>
                  </select>
                </div>
              </div>
              <div className="form-group">
                <label>Status</label>
                <select
                  value={formData.status}
                  onChange={(e) => setFormData({ ...formData, status: e.target.value })}
                >
                  <option value="active">Active</option>
                  <option value="inactive">Inactive</option>
                </select>
              </div>
              <div className="modal-actions">
                <button type="button" className="btn-secondary" onClick={() => { setShowModal(false); setEditingAccount(null); resetForm(); }}>
                  Cancel
                </button>
                <button type="submit" className="btn-primary">
                  {editingAccount ? 'Update' : 'Create'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}



