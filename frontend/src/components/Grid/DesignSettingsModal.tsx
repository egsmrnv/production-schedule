import { useState, useEffect } from 'react';
import styles from './DesignSettingsModal.module.css';

export interface ThemeSettings {
  emptyCellColor: string;
  weekendColor: string;
  shiftColor: string;
  pavilionColor: string;
  warehouseColor: string;
  transferColor: string;
  stopColor: string;
  hoverGlowColor: string;
}

export const DEFAULT_THEME: ThemeSettings = {
  emptyCellColor: '#121212',
  weekendColor: '#121212',
  shiftColor: '#1c1c1e',
  pavilionColor: '#2d1b4e',
  warehouseColor: '#3c2b1e',
  transferColor: '#1e3c3c',
  stopColor: '#660000',
  hoverGlowColor: '#0a84ff'
};

export const DesignSettingsModal = ({ isOpen, onClose, onSave, initialSettings }: any) => {
  const [settings, setSettings] = useState<ThemeSettings>(DEFAULT_THEME);

  useEffect(() => {
    if (isOpen && initialSettings) {
      setSettings(prev => ({ ...prev, ...initialSettings }));
    }
  }, [isOpen, initialSettings]);

  if (!isOpen) return null;

  const handleChange = (key: keyof ThemeSettings, val: string) => {
    setSettings(prev => ({ ...prev, [key]: val }));
  };

  return (
    <div className={styles.overlay} onMouseDown={onClose}>
      <div className={styles.modal} onMouseDown={e => e.stopPropagation()}>
        <div className={styles.header}>
          <h2>Настройки дизайна</h2>
          <button className={styles.closeBtn} onClick={onClose}>&times;</button>
        </div>
        <div className={styles.body}>
          <div className={styles.field}>
            <label>Пустая ячейка</label>
            <input type="color" value={settings.emptyCellColor} onChange={e => handleChange('emptyCellColor', e.target.value)} />
          </div>
          <div className={styles.field}>
            <label>Выходной / Отсыпной</label>
            <input type="color" value={settings.weekendColor} onChange={e => handleChange('weekendColor', e.target.value)} />
          </div>
          <div className={styles.field}>
            <label>Обычная смена (Натура)</label>
            <input type="color" value={settings.shiftColor} onChange={e => handleChange('shiftColor', e.target.value)} />
          </div>
          <div className={styles.field}>
            <label>Смена (Павильон)</label>
            <input type="color" value={settings.pavilionColor} onChange={e => handleChange('pavilionColor', e.target.value)} />
          </div>
          <div className={styles.field}>
            <label>Смена (Склад)</label>
            <input type="color" value={settings.warehouseColor} onChange={e => handleChange('warehouseColor', e.target.value)} />
          </div>
          <div className={styles.field}>
            <label>Смена (Переезд)</label>
            <input type="color" value={settings.transferColor} onChange={e => handleChange('transferColor', e.target.value)} />
          </div>
          <div className={styles.field}>
            <label>СТОП</label>
            <input type="color" value={settings.stopColor} onChange={e => handleChange('stopColor', e.target.value)} />
          </div>
          <div className={styles.field}>
            <label>Цвет свечения (Hover)</label>
            <input type="color" value={settings.hoverGlowColor || '#0a84ff'} onChange={e => handleChange('hoverGlowColor', e.target.value)} />
          </div>
        </div>
        <div className={styles.footer}>
          <button className={styles.cancelBtn} onClick={() => setSettings(DEFAULT_THEME)}>Сброс</button>
          <div style={{ flex: 1 }}></div>
          <button className={styles.cancelBtn} onClick={onClose}>Отмена</button>
          <button className={styles.saveBtn} onClick={() => onSave(settings)}>Сохранить</button>
        </div>
      </div>
    </div>
  );
};
