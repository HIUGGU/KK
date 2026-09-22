import { useState, useEffect } from 'react';
import { apiClient } from '../api/client';
import './MaterialMasters.css';

interface Master {
  id?: number;
  name: string;
  description?: string;
  status?: string;
  in_use_count?: number;
}

type MasterKind = 'point' | 'size';

const emptyMaster = (): Master => ({ name: '', description: '', status: 'active' });

export default function MaterialMasters() {
  const [points, setPoints] = useState<Master[]>([]);
  const [sizes, setSizes] = useState<Master[]>([]);
  const [showModal, setShowModal] = useState(false);
  const [modalKind, setModalKind] = useState<MasterKind>('point');
  const [editing, setEditing] = useState<Master | null>(null);
  const [formData, setFormData] = useState<Master>(emptyMaster());

  useEffect(() => {
    loadAll();
  }, []);

  const loadAll = async () => {
    try {
      const [pointData, sizeData] = await Promise.all([
        apiClient.getAllMaterialPoints(),
        apiClient.getAllMaterialSizes(),
      ]);
      setPoints(pointData as Master[]);
      setSizes(sizeData as Master[]);
    } catch (error) {
      console.error('Failed to load material masters:', error);
    }
  };

  const openAdd = (kind: MasterKind) => {
    setModalKind(kind);
    setEditing(null);
    setFormData(emptyMaster());
    setShowModal(true);
  };

  const openEdit = (kind: MasterKind, master: Master) => {
    setModalKind(kind);
    setEditing(master);
    setFormData({ ...emptyMaster(), ...master });
    setShowModal(true);
  };

  const closeModal = () => {
    setShowModal(false);
    setEditing(null);
    setFormData(emptyMaster());
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (editing?.id) {
        if (modalKind === 'point') {
          await apiClient.updateMaterialPoint(editing.id, formData);
        } else {
          await apiClient.updateMaterialSize(editing.id, formData);
        }
      } else {
        if (modalKind === 'point') {
          await apiClient.createMaterialPoint(formData);
        } else {
          await apiClient.createMaterialSize(formData);
        }
      }
      closeModal();
      loadAll();
    } catch (error: any) {
      console.error('Failed to save master:', error);
      alert(error.message || 'Failed to save. Please try again.');
    }
  };

  const handleDelete = async (kind: MasterKind, master: Master) => {
    if (!confirm(`Are you sure you want to delete "${master.name}"?`)) return;
    try {
      if (kind === 'point') {
        await apiClient.deleteMaterialPoint(master.id!);
      } else {
        await apiClient.deleteMaterialSize(master.id!);
      }
      loadAll();
    } catch (error: any) {
      console.error('Failed to delete master:', error);
      alert(error.message || 'Failed to delete. Please try again.');
    }
  };

  const renderPanel = (kind: MasterKind, title: string, items: Master[], hint: string) => (
    <div className="master-panel">
      <div className="master-panel-header">
        <h2>{title}</h2>
        <button className="btn-primary" onClick={() => openAdd(kind)}>
          + Add
        </button>
      </div>
      <p className="master-panel-hint">{hint}</p>
      <table className="masters-table">
        <thead>
          <tr>
            <th>Name</th>
            <th>Description</th>
            <th>Used By</th>
            <th>Status</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          {items.length === 0 ? (
            <tr>
              <td colSpan={5} style={{ textAlign: 'center', padding: '30px' }}>
                Nothing added yet.
              </td>
            </tr>
          ) : (
            items.map((item) => (
              <tr key={item.id}>
                <td><strong>{item.name}</strong></td>
                <td>{item.description || '-'}</td>
                <td>{item.in_use_count ?? 0}</td>
                <td>
                  <span className={`status-badge ${item.status}`}>
                    {item.status || 'active'}
                  </span>
                </td>
                <td>
                  <button className="btn-edit" onClick={() => openEdit(kind, item)}>
                    Edit
                  </button>
                  <button className="btn-delete" onClick={() => handleDelete(kind, item)}>
                    Delete
                  </button>
                </td>
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );

  const modalLabel = modalKind === 'point' ? 'Point' : 'Size';

  return (
    <div className="material-masters">
      <div className="page-header">
        <h1>Material Masters</h1>
      </div>

      <div className="master-panels">
        {renderPanel('point', 'Points', points, 'The point values you can pick when adding raw material.')}
        {renderPanel('size', 'Sizes', sizes, 'The size values you can pick when adding raw material.')}
      </div>

      {showModal && (
        <div className="modal-overlay" onClick={closeModal}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <h2>{editing ? `Edit ${modalLabel}` : `Add ${modalLabel}`}</h2>
            <form onSubmit={handleSubmit}>
              <div className="form-group">
                <label>{modalLabel} Name *</label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder={modalKind === 'point' ? 'e.g. P4' : 'e.g. 6mm'}
                  required
                  autoFocus
                />
              </div>
              <div className="form-group">
                <label>Description</label>
                <textarea
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  rows={2}
                />
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
                <button type="button" className="btn-secondary" onClick={closeModal}>
                  Cancel
                </button>
                <button type="submit" className="btn-primary">
                  {editing ? 'Update' : 'Create'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
