import React, { useState, useEffect } from 'react';
import styles from './DesignSettingsModal.module.css';

interface AddEquipmentModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (emoji: string, name: string, color: string) => void;
}

export const AddEquipmentModal: React.FC<AddEquipmentModalProps> = ({ isOpen, onClose, onSave }) => {
  const [emoji, setEmoji] = useState('🚗');
  const [name, setName] = useState('');
  const [color, setColor] = useState('#cccccc');

  useEffect(() => {
    if (isOpen) {
      setEmoji('🚗');
      setName('');
      setColor('#cccccc');
    }
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <div className={styles.overlay} onMouseDown={onClose}>
      <div className={styles.modal} onMouseDown={e => e.stopPropagation()}>
        <div className={styles.header}>
          <h2>Добавить технику</h2>
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
          <div className={styles.field}>
            <label>Цвет выделения</label>
            <input type="color" value={color} onChange={e => setColor(e.target.value)} />
          </div>
          <div style={{ display: 'flex', gap: '10px', marginTop: '20px' }}>
            <button 
              onClick={() => {
                if (!emoji.trim() || !name.trim()) {
                  alert('Заполните эмодзи и название');
                  return;
                }
                onSave(emoji.trim(), name.trim(), color);
              }}
              style={{ flex: 1, padding: '10px', background: 'var(--primary-color)', color: '#fff', border: 'none', borderRadius: '4px', cursor: 'pointer' }}
            >
              Добавить
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
