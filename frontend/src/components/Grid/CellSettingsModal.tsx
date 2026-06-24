import React, { useState, useEffect } from 'react';
import styles from './CellSettingsModal.module.css';

export interface StructuredData {
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
}

export const CellSettingsModal: React.FC<CellSettingsModalProps> = ({
  isOpen, onClose, onSave, initialData, date, columnName, staffList
}) => {
  const carsOptions = [
    { id: 'white', label: '⬛️/⚫️ Белый спринтер/крафтер', color: '#cccccc' },
    { id: 'green', label: '🟢 Зеленый спринтер', color: '#b6d7a8' },
    { id: 'orange', label: '🟠 Оранжевый', color: '#fce5cd' },
  ];

  const dayTypeOptions = ['натура', 'павильон', 'склад', 'переезд'];
  const extraOptions = ['погрузка', 'разгрузка'];

  const [data, setData] = useState<StructuredData>({});
  
  useEffect(() => {
    if (isOpen) {
      let parsedStaff = initialData.staff || [];
      // Auto-extract from legacy text if not present
      if (!initialData.staff && initialData.text) {
        const exclude = ['Выходной', 'СТОП', 'Нет', 'ОТМЕНА', 'СМЕНЫ', 'СВОИ', 'ЛИЦЕМЕРЫ', 'Фестиваль'];
        const words = initialData.text.split(/[\s/(),[\]]+/);
        const foundStaff = new Set<string>();
        words.forEach((w: string) => {
          const cleanWord = w.replace(/[^\p{L}]/gu, '');
          if (
            cleanWord.length > 2 && 
            cleanWord[0] === cleanWord[0].toUpperCase() && 
            cleanWord[0] !== cleanWord[0].toLowerCase() && 
            !exclude.includes(cleanWord)
          ) {
            foundStaff.add(cleanWord);
          }
        });
        parsedStaff = Array.from(foundStaff);
      }

      let parsedCars = initialData.cars || [];
      if (!initialData.cars && initialData.color) {
        const matchedCar = carsOptions.find(c => c.color.toLowerCase() === initialData.color?.toLowerCase());
        if (matchedCar) parsedCars = [matchedCar.label];
      }

      setData({
        ...initialData,
        staff: parsedStaff,
        cars: parsedCars,
        dayType: initialData.dayType || '',
        options: initialData.options || []
      });
    }
  }, [isOpen, initialData]);

  if (!isOpen) return null;

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
    // Check if changes made
    const hasChanged = 
      JSON.stringify(data.staff) !== JSON.stringify(initialData.staff) ||
      JSON.stringify(data.cars) !== JSON.stringify(initialData.cars) ||
      data.dayType !== (initialData.dayType || '') ||
      JSON.stringify(data.options) !== JSON.stringify(initialData.options || []);

    if (!hasChanged && initialData.staff !== undefined) {
      // Nothing changed, and it's not a legacy conversion
      onClose();
      return;
    }

    // Determine cell text from staff for fallback text rendering
    let text = data.staff && data.staff.length > 0 ? data.staff.join(' ') : (data.text || '');
    if (data.dayType) text += ` [${data.dayType}]`;
    if (data.options && data.options.length > 0) text += ` (${data.options.join(', ')})`;
    
    // Determine cell color from cars
    let color = data.color || '';
    if (data.cars && data.cars.length > 0) {
      const carObj = carsOptions.find(c => c.label === data.cars![0]);
      if (carObj) color = carObj.color;
    }

    onSave({ ...data, text, color });
  };

  return (
    <div className={styles.overlay} onMouseDown={onClose}>
      <div className={styles.modal} onMouseDown={e => e.stopPropagation()}>
        <div className={styles.header}>
          <h2>{date} — {columnName}</h2>
          <button className={styles.closeBtn} onClick={onClose}>&times;</button>
        </div>
        <div className={styles.body}>
          
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
            <select className={styles.select} onChange={handleAddStaff} defaultValue="">
              <option value="" disabled>+ Добавить сотрудника</option>
              {staffList.filter(s => !data.staff?.includes(s)).map(s => (
                <option key={s} value={s}>{s}</option>
              ))}
            </select>
          </div>

          <div className={styles.formGroup}>
            <label>Машины</label>
            <div className={styles.checkboxList}>
              {carsOptions.map(car => (
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
            <label>Тип дня</label>
            <select 
              className={styles.select} 
              value={data.dayType || ''}
              onChange={e => setData(prev => ({ ...prev, dayType: e.target.value }))}
            >
              <option value="">(Не выбран)</option>
              {dayTypeOptions.map(dt => (
                <option key={dt} value={dt}>{dt}</option>
              ))}
            </select>
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

        </div>
        <div className={styles.footer}>
          <button className={styles.cancelBtn} onClick={onClose}>Отмена</button>
          <button className={styles.saveBtn} onClick={handleSave}>Сохранить</button>
        </div>
      </div>
    </div>
  );
};
