import React, { useState, useEffect } from 'react';
import styles from './DesignSettingsModal.module.css';

export interface ProjectData {
  id?: string;
  name: string;
  color: string;
}

interface ProjectSettingsModalProps {
  isOpen: boolean;
  project: ProjectData | null;
  onClose: () => void;
  onSave: (project: ProjectData) => void;
  onDelete?: (id: string) => void;
}

export const ProjectSettingsModal: React.FC<ProjectSettingsModalProps> = ({ isOpen, project, onClose, onSave, onDelete }) => {
  const [name, setName] = useState('');
  const [color, setColor] = useState('#0a84ff');

  useEffect(() => {
    if (isOpen) {
      setName(project?.name || '');
      setColor(project?.color || '#0a84ff');
    }
  }, [isOpen, project]);

  if (!isOpen) return null;

  return (
    <div className={styles.overlay} onMouseDown={onClose}>
      <div className={styles.modal} onMouseDown={e => e.stopPropagation()}>
        <div className={styles.header}>
          <h2>{project?.id ? 'Редактировать проект' : 'Новый проект'}</h2>
          <button className={styles.closeBtn} onClick={onClose}>&times;</button>
        </div>
        <div className={styles.body}>
          <div className={styles.field}>
            <label>Название проекта</label>
            <input type="text" value={name} onChange={e => setName(e.target.value)} placeholder="Например, Реклама Coca-Cola" />
          </div>
          <div className={styles.field}>
            <label>Цвет проекта</label>
            <input type="color" value={color} onChange={e => setColor(e.target.value)} />
          </div>
          <div style={{ display: 'flex', gap: '10px', marginTop: '20px' }}>
            <button 
              onClick={() => onSave({ id: project?.id, name, color })}
              style={{ flex: 1, padding: '10px', background: 'var(--primary-color)', color: '#fff', border: 'none', borderRadius: '4px', cursor: 'pointer' }}
            >
              Сохранить
            </button>
            {project?.id && onDelete && (
              <button 
                onClick={() => {
                  if (window.confirm('Точно удалить проект из справочника? Данные в таблице останутся с последним цветом.')) {
                    onDelete(project.id!);
                  }
                }}
                style={{ padding: '10px', background: 'var(--danger-color)', color: '#fff', border: 'none', borderRadius: '4px', cursor: 'pointer' }}
              >
                Удалить
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
