import React, { useState, useEffect } from 'react';
import styles from './CellSettingsModal.module.css';

export interface StructuredData {
  cellType?: 'project_start' | 'shift' | 'day_off' | 'stop' | '';
  projectName?: string;
  text?: string;
  color?: string;
  staff?: string[];
  cars?: string[];
  dayType?: string;
  options?: string[];
}

interface CellSettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (data: StructuredData) => void;
  initialData: StructuredData;
  date: string;
  columnName: string;
  staffList: string[];
  cars: any[];
  activeProject: { name: string; color: string } | null;
}

export const CellSettingsModal: React.FC<CellSettingsModalProps> = ({
  isOpen, onClose, onSave, initialData, date, columnName, staffList, cars, activeProject
}) => {
  const shiftDayTypeOptions = ['натура', 'павильон', 'склад', 'переезд'];
  const extraOptions = ['погрузка', 'разгрузка'];
  // Pre-defined vibrant colors for projects
  const projectColors = ['#e06666', '#f6b26b', '#ffd966', '#93c47d', '#76a5af', '#9fc5e8', '#8e7cc3', '#c27ba0'];

  const [data, setData] = useState<StructuredData>({});

  useEffect(() => {
    if (isOpen) {
      let type = initialData.cellType;
      
      // Auto-detect legacy cell types
      if (!type) {
        if (initialData.dayType === 'стоп' || initialData.text === 'СТОП') type = 'stop';
        else if (initialData.dayType === 'выходной' || initialData.dayType === 'отсыпной' || initialData.text === 'Выходной' || initialData.text === 'Отсыпной') type = 'day_off';
        else if (initialData.projectName || (initialData.text && !activeProject && !initialData.staff?.length && !initialData.cars?.length)) type = 'project_start';
        else if (initialData.staff?.length || initialData.cars?.length || initialData.dayType || initialData.text) type = 'shift';
        else type = '';
      }

      let parsedStaff = initialData.staff || [];
      if (!initialData.staff && initialData.text && type === 'shift') {
        const exclude = ['Выходной', 'СТОП', 'Нет', 'ОТМЕНА', 'СМЕНЫ', 'СВОИ', 'ЛИЦЕМЕРЫ', 'Фестиваль'];
        const words = initialData.text.split(/[\s/(),[\]]+/);
        const foundStaff = new Set<string>();
        words.forEach((w: string) => {
          const cleanWord = w.replace(/[^\p{L}]/gu, '');
          if (cleanWord.length > 2 && cleanWord[0] === cleanWord[0].toUpperCase() && cleanWord[0] !== cleanWord[0].toLowerCase() && !exclude.includes(cleanWord)) {
            foundStaff.add(cleanWord);
          }
        });
        parsedStaff = Array.from(foundStaff);
      }

      let parsedCars = initialData.cars || [];
      if (!initialData.cars && initialData.text && type === 'shift') {
        const foundCar = cars.find(c => {
          const emoji = c.label.match(/\p{Emoji}/u)?.[0];
          return emoji && initialData.text!.includes(emoji);
        });
        if (foundCar) parsedCars = [foundCar.label];
      }

      setData({
        ...initialData,
        cellType: type,
        projectName: initialData.projectName || (type === 'project_start' ? initialData.text : ''),
        staff: parsedStaff,
        cars: parsedCars,
        dayType: initialData.dayType || '',
        options: initialData.options || []
      });
    }
  }, [isOpen, initialData, cars, activeProject]);

  if (!isOpen) return null;

  const availableTypes = activeProject 
    ? [
        {val: 'shift', label: 'Смена'}, 
        {val: 'day_off', label: 'Выходной / Отсыпной'}, 
        {val: 'stop', label: 'Стоп (Закрыть проект)'}
      ]
    : [
        {val: 'project_start', label: 'Старт проекта'}
      ];

  const primaryColor = activeProject?.color || 'var(--primary-color)';
  const glowStyle = activeProject ? `0 0 20px ${activeProject.color}4D` : 'none';

  const handleClear = () => {
    setData({ cellType: '' });
  };

  const handleAddStaff = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const val = e.target.value;
    if (!val) return;
    if (!data.staff?.includes(val)) {
      setData(prev => ({ ...prev, staff: [...(prev.staff || []), val] }));
    }
    e.target.value = '';
  };

  const handleRemoveStaff = (name: string) => {
    setData(prev => ({ ...prev, staff: prev.staff?.filter(s => s !== name) }));
  };

  const toggleCar = (carLabel: string) => {
    const current = data.cars || [];
    if (current.includes(carLabel)) {
      setData(prev => ({ ...prev, cars: current.filter(c => c !== carLabel) }));
    } else {
      setData(prev => ({ ...prev, cars: [...current, carLabel] }));
    }
  };

  const toggleOption = (opt: string) => {
    const current = data.options || [];
    if (current.includes(opt)) {
      setData(prev => ({ ...prev, options: current.filter(c => c !== opt) }));
    } else {
      setData(prev => ({ ...prev, options: [...current, opt] }));
    }
  };

  const handleSave = () => {
    if (!data.cellType) {
      onSave({}); // empty cell
      return;
    }
    
    if (data.cellType === 'shift' && !data.dayType) {
      alert('Пожалуйста, выберите локацию (натура, павильон и т.д.) для этой смены.');
      return;
    }

    let text = '';
    let color = data.color || '';
    
    if (data.cellType === 'project_start') {
      text = data.projectName?.trim() || 'Новый проект';
      if (!color) color = projectColors[Math.floor(Math.random() * projectColors.length)];
    } else if (data.cellType === 'stop') {
      text = 'СТОП';
    } else if (data.cellType === 'day_off') {
      text = data.dayType === 'отсыпной' ? 'Отсыпной' : 'Выходной';
    } else if (data.cellType === 'shift') {
      text = data.staff && data.staff.length > 0 ? data.staff.join(' ') : '';
      if (data.dayType) text += ` [${data.dayType}]`;
      if (data.options && data.options.length > 0) text += ` (${data.options.join(', ')})`;
      
      if (data.cars && data.cars.length > 0) {
        const carObj = cars.find(c => c.label === data.cars![0]);
        if (carObj) color = carObj.color;
      }
    }

    onSave({ ...data, text, color });
  };

  return (
    <div className={styles.overlay} onMouseDown={onClose}>
      <div 
        className={styles.modal} 
        onMouseDown={e => e.stopPropagation()}
        style={{ boxShadow: glowStyle }}
      >
        <div className={styles.header}>
          <h2>
            {date}
            {activeProject && <span style={{ color: primaryColor }}> — {activeProject.name}</span>}
          </h2>
          <button className={styles.closeBtn} onClick={onClose}>&times;</button>
        </div>
        
        <div className={styles.body}>

          <div className={styles.formGroup}>
            <label>Тип ячейки</label>
            <select 
              className={styles.select} 
              value={data.cellType || ''}
              onChange={(e) => setData({ cellType: e.target.value as any, projectName: data.projectName, color: data.color })}
            >
              <option value="" disabled>(Не выбран)</option>
              {availableTypes.map(t => (
                <option key={t.val} value={t.val}>{t.label}</option>
              ))}
            </select>
          </div>

          {data.cellType === 'project_start' && (
            <>
              <div className={styles.formGroup}>
                <label>Название проекта</label>
                <input 
                  type="text" 
                  className={styles.select} // reusing input-like styling
                  style={{ width: '100%', padding: '8px', border: '1px solid var(--border-color)', borderRadius: '4px', background: 'var(--input-bg)', color: 'var(--text-primary)', boxSizing: 'border-box' }}
                  placeholder="Введите название проекта..."
                  value={data.projectName || ''}
                  onChange={e => setData(prev => ({...prev, projectName: e.target.value}))}
                />
              </div>
              <div className={styles.formGroup}>
                <label>Цвет проекта</label>
                <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                  {projectColors.map(c => (
                    <div 
                      key={c}
                      onClick={() => setData(prev => ({...prev, color: c}))}
                      style={{
                        width: '24px', height: '24px', borderRadius: '4px', backgroundColor: c, cursor: 'pointer',
                        border: data.color === c ? '2px solid var(--text-primary)' : '1px solid var(--border-color)'
                      }}
                    />
                  ))}
                </div>
              </div>
            </>
          )}

          {data.cellType === 'day_off' && (
            <div className={styles.formGroup}>
              <label>Тип выходного</label>
              <select 
                className={styles.select} 
                value={data.dayType || 'выходной'}
                onChange={e => setData(prev => ({...prev, dayType: e.target.value}))}
              >
                <option value="выходной">Выходной</option>
                <option value="отсыпной">Отсыпной</option>
              </select>
            </div>
          )}

          {data.cellType === 'shift' && (
            <>
              <div className={styles.formGroup}>
                <label>Локация (опционально)</label>
                <select 
                  className={styles.select} 
                  value={shiftDayTypeOptions.includes(data.dayType || '') ? data.dayType : ''}
                  onChange={e => setData(prev => ({...prev, dayType: e.target.value}))}
                >
                  <option value="">(Не выбрано)</option>
                  {shiftDayTypeOptions.map(dt => (
                    <option key={dt} value={dt}>{dt.charAt(0).toUpperCase() + dt.slice(1)}</option>
                  ))}
                </select>
              </div>

              <div className={styles.formGroup}>
                <label>Сотрудники</label>
                <div className={styles.staffList}>
                  {data.staff?.map(name => (
                    <div key={name} className={styles.staffTag}>
                      {name}
                      <button className={styles.removeBtn} onClick={() => handleRemoveStaff(name)}>✕</button>
                    </div>
                  ))}
                </div>
                <select className={styles.select} onChange={handleAddStaff} value="">
                  <option value="" disabled>+ Добавить сотрудника</option>
                  {staffList.filter(s => !data.staff?.includes(s)).map(s => (
                    <option key={s} value={s}>{s}</option>
                  ))}
                </select>
              </div>

              <div className={styles.formGroup}>
                <label>Машины</label>
                <div className={styles.checkboxList}>
                  {cars.map(car => (
                    <label key={car.id} className={styles.checkboxLabel}>
                      <input 
                        type="checkbox" 
                        checked={(data.cars || []).includes(car.label)}
                        onChange={() => toggleCar(car.label)}
                      />
                      {car.label}
                    </label>
                  ))}
                </div>
              </div>

              <div className={styles.formGroup}>
                <label>Доп. опции</label>
                <div className={styles.checkboxList}>
                  {extraOptions.map(opt => (
                    <label key={opt} className={styles.checkboxLabel}>
                      <input 
                        type="checkbox" 
                        checked={(data.options || []).includes(opt)}
                        onChange={() => toggleOption(opt)}
                      />
                      {opt}
                    </label>
                  ))}
                </div>
              </div>
            </>
          )}

        </div>
        <div className={styles.footer} style={{ display: 'flex', flexDirection: 'row', justifyContent: 'flex-end', alignItems: 'center', gap: '12px' }}>
          <button className={styles.cancelBtn} style={{ color: 'var(--danger-color)', marginRight: 'auto' }} onClick={handleClear}>Очистить</button>
          <button className={styles.cancelBtn} onClick={onClose}>Отмена</button>
          <button className={styles.saveBtn} style={{ backgroundColor: primaryColor }} onClick={handleSave}>Сохранить</button>
        </div>
      </div>
    </div>
  );
};
