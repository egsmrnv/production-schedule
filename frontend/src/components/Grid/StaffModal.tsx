import React, { useState, useEffect } from 'react';
import styles from './DesignSettingsModal.module.css';

interface StaffModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (name: string) => void;
  initialName?: string;
}

export const StaffModal: React.FC<StaffModalProps> = ({ isOpen, onClose, onSave, initialName }) => {
  const [name, setName] = useState('');

  useEffect(() => {
    if (isOpen) {
      setName(initialName || '');
    }
  }, [isOpen, initialName]);

  if (!isOpen) return null;

  return (
    <div className={styles.overlay} onMouseDown={onClose}>
      <div className={styles.modal} onMouseDown={e => e.stopPropagation()}>
        <div className={styles.header}>
          <h2>{initialName ? 'Редактировать сотрудника' : 'Добавить сотрудника'}</h2>
          <button className={styles.closeBtn} onClick={onClose}>&times;</button>
        </div>
        <div className={styles.body}>
          <div className={styles.field}>
            <label>Имя</label>
            <input type="text" value={name} onChange={e => setName(e.target.value)} placeholder="Иван Иванов" />
          </div>
          <div style={{ display: 'flex', gap: '10px', marginTop: '20px' }}>
            <button 
              onClick={() => {
                if (!name.trim()) {
                  alert('Имя не может быть пустым');
                  return;
                }
                onSave(name.trim());
              }}
              style={{ flex: 1, padding: '10px', background: 'var(--primary-color)', color: '#fff', border: 'none', borderRadius: '4px', cursor: 'pointer' }}
            >
              {initialName ? 'Сохранить' : 'Добавить'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
