import React, { useState } from 'react';
import styles from './CellSettingsModal.module.css';

interface Column {
  id: string;
  name: string;
}

interface ColumnSettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  columns: Column[];
  onSave: (newColumns: Column[], deletedIds: string[], addedColumns: {name: string, order: number}[]) => Promise<void>;
}

export const ColumnSettingsModal: React.FC<ColumnSettingsModalProps> = ({ isOpen, onClose, columns, onSave }) => {
  const [localColumns, setLocalColumns] = useState<Column[]>(columns);
  const [deletedIds, setDeletedIds] = useState<string[]>([]);
  const [addedColumns, setAddedColumns] = useState<{name: string, order: number}[]>([]);
  const [isSaving, setIsSaving] = useState(false);

  if (!isOpen) return null;

  const handleMoveUp = (index: number) => {
    if (index === 0) return;
    const newCols = [...localColumns];
    const temp = newCols[index - 1];
    newCols[index - 1] = newCols[index];
    newCols[index] = temp;
    setLocalColumns(newCols);
  };

  const handleMoveDown = (index: number) => {
    if (index === localColumns.length - 1) return;
    const newCols = [...localColumns];
    const temp = newCols[index + 1];
    newCols[index + 1] = newCols[index];
    newCols[index] = temp;
    setLocalColumns(newCols);
  };

  const handleDelete = (index: number) => {
    const col = localColumns[index];
    if (window.confirm(`Вы уверены, что хотите удалить эту колонку? Это удалит все данные в этом столбце за все дни!`)) {
      if (!col.id.startsWith('new-')) {
        setDeletedIds(prev => [...prev, col.id]);
      } else {
        setAddedColumns(prev => prev.filter(c => c.name !== col.name));
      }
      const newCols = [...localColumns];
      newCols.splice(index, 1);
      setLocalColumns(newCols);
    }
  };

  const handleAdd = () => {
    const newName = `Колонка ${Math.floor(Math.random() * 1000)}`;
    const newCol = { name: newName, order: localColumns.length, id: `new-${Date.now()}` };
    setLocalColumns([...localColumns, newCol]);
    setAddedColumns([...addedColumns, { name: newCol.name, order: newCol.order }]);
  };

  const handleSave = async () => {
    setIsSaving(true);
    try {
      await onSave(localColumns, deletedIds, addedColumns);
      onClose();
    } catch (e) {
      console.error(e);
      alert('Ошибка при сохранении колонок');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className={styles.modalOverlay} onClick={onClose}>
      <div className={styles.modalContent} onClick={(e) => e.stopPropagation()}>
        <div className={styles.modalHeader}>
          <h3>Управление колонками</h3>
          <button className={styles.closeBtn} onClick={onClose}>&times;</button>
        </div>

        <div className={styles.modalBody} style={{ maxHeight: '400px', overflowY: 'auto' }}>
          <p style={{ fontSize: '12px', color: 'var(--text-secondary)', marginBottom: '16px' }}>
            Изменяйте порядок, удаляйте неактуальные колонки или добавляйте новые пустые пространства для проектов.
          </p>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginBottom: '20px' }}>
            {localColumns.map((col, idx) => (
              <div key={col.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', backgroundColor: 'var(--grid-bg)', padding: '8px 12px', borderRadius: '4px', border: '1px solid var(--border-color)' }}>
                <span style={{ fontWeight: 500, flex: 1, color: 'var(--text-secondary)' }}>Столбец {idx + 1}</span>
                <div style={{ display: 'flex', gap: '8px' }}>
                  <button 
                    onClick={() => handleMoveUp(idx)} 
                    disabled={idx === 0}
                    style={{ background: 'transparent', border: 'none', color: idx === 0 ? 'var(--text-secondary)' : 'var(--text-primary)', cursor: idx === 0 ? 'default' : 'pointer' }}
                  >
                    ↑
                  </button>
                  <button 
                    onClick={() => handleMoveDown(idx)} 
                    disabled={idx === localColumns.length - 1}
                    style={{ background: 'transparent', border: 'none', color: idx === localColumns.length - 1 ? 'var(--text-secondary)' : 'var(--text-primary)', cursor: idx === localColumns.length - 1 ? 'default' : 'pointer' }}
                  >
                    ↓
                  </button>
                  <button 
                    onClick={() => handleDelete(idx)}
                    style={{ background: 'transparent', border: 'none', color: 'var(--danger-color)', cursor: 'pointer', marginLeft: '8px' }}
                  >
                    Удалить
                  </button>
                </div>
              </div>
            ))}
            {localColumns.length === 0 && (
              <div style={{ color: 'var(--text-secondary)', fontSize: '13px' }}>Нет проектов.</div>
            )}
          </div>

          <div style={{ display: 'flex', gap: '8px', marginTop: '16px', borderTop: '1px solid var(--border-color)', paddingTop: '16px' }}>
            <button className={styles.saveBtn} style={{ width: '100%', padding: '10px' }} onClick={handleAdd}>+ Добавить столбец</button>
          </div>
        </div>

        <div className={styles.modalFooter}>
          <button className={styles.cancelBtn} onClick={onClose} disabled={isSaving}>Отмена</button>
          <button className={styles.saveBtn} onClick={handleSave} disabled={isSaving}>
            {isSaving ? 'Сохранение...' : 'Сохранить изменения'}
          </button>
        </div>
      </div>
    </div>
  );
};
