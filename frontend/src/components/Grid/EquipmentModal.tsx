import React, { useState, useEffect } from 'react';
import styles from './DesignSettingsModal.module.css';

interface EquipmentModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (emoji: string, name: string) => void;
  initialData?: { emoji: string, name: string } | null;
}

export const EquipmentModal: React.FC<EquipmentModalProps> = ({ isOpen, onClose, onSave, initialData }) => {
  const [emoji, setEmoji] = useState('🚗');
  const [name, setName] = useState('');

  useEffect(() => {
    if (isOpen) {
      if (initialData) {
        setEmoji(initialData.emoji);
        setName(initialData.name);
      } else {
        setEmoji('🚗');
        setName('');
      }
    }
  }, [isOpen, initialData]);

  if (!isOpen) return null;

  return (
    <div className={styles.overlay} onMouseDown={onClose}>
      <div className={styles.modal} onMouseDown={e => e.stopPropagation()}>
        <div className={styles.header}>
          <h2>{initialData ? 'Редактировать технику' : 'Добавить технику'}</h2>
          <button className={styles.closeBtn} onClick={onClose}>&times;</button>
        </div>
        <div className={styles.body}>
          <div className={styles.field}>
            <label>Эмодзи</label>
            <input type="text" value={emoji} onChange={e => setEmoji(e.target.value)} placeholder="Например, 🚜" />
          </div>
          <div className={styles.field}>
            <label>Название</label>
            <input type="text" value={name} onChange={e => setName(e.target.value)} placeholder="Например, Экскаватор" />
          </div>
          <div style={{ display: 'flex', gap: '10px', marginTop: '20px' }}>
            <button 
              onClick={() => {
                const trimmedEmoji = emoji.trim();
                const trimmedName = name.trim();
                if (!trimmedEmoji || !trimmedName) {
                  alert('Заполните эмодзи и название');
                  return;
                }
                if ([...trimmedEmoji].length !== 1) {
                  alert('Эмодзи должен состоять ровно из одного символа');
                  return;
                }
                onSave(trimmedEmoji, trimmedName);
              }}
              style={{ flex: 1, padding: '10px', background: 'var(--primary-color)', color: '#fff', border: 'none', borderRadius: '4px', cursor: 'pointer' }}
            >
              {initialData ? 'Сохранить' : 'Добавить'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
