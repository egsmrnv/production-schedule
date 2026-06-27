import React, { useState, useEffect } from 'react';
import styles from './CellSettingsModal.module.css';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface StructuredData {
  cellType?: 'project_start' | 'shift' | 'day_off' | 'stop' | '';
  projectId?: string;
  comment?: string;
  projectName?: string; // Legacy fallback
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
  columnName: string; // kept for API compat, not rendered
  staffList: string[];
  cars: any[];
  globalProjects: any[]; // ProjectData[]
  activeProject: { name: string; color: string; comment?: string } | null;
}

// ─── Constants (module-level, never re-created) ────────────────────────────────

const SHIFT_DAY_TYPES = ['натура', 'павильон', 'склад', 'переезд'] as const;
const EXTRA_OPTIONS = ['погрузка', 'разгрузка'] as const;
const PROJECT_COLORS = ['#e06666', '#f6b26b', '#ffd966', '#93c47d', '#76a5af', '#9fc5e8', '#8e7cc3', '#c27ba0'];

// ─── Auto-detect cell type from legacy flat data ───────────────────────────────

const detectLegacyCellType = (d: StructuredData, hasActiveProject: boolean): StructuredData['cellType'] => {
  if (d.cellType) return d.cellType;
  if (d.dayType === 'стоп' || d.text === 'СТОП') return 'stop';
  if (d.dayType === 'выходной' || d.dayType === 'отсыпной' || d.text === 'Выходной' || d.text === 'Отсыпной') return 'day_off';
  if (d.projectName || (d.text && !hasActiveProject && !d.staff?.length && !d.cars?.length)) return 'project_start';
  if (d.staff?.length || d.cars?.length || d.dayType || d.text) return 'shift';
  
  if (!hasActiveProject) return 'project_start';
  return '';
};

// ─── Component ────────────────────────────────────────────────────────────────

export const CellSettingsModal: React.FC<CellSettingsModalProps> = ({
  isOpen, onClose, onSave, initialData, date, staffList, cars, globalProjects, activeProject,
}) => {
  const [data, setData] = useState<StructuredData>({});

  // Reset form whenever the modal opens for a new cell
  useEffect(() => {
    if (!isOpen) return;

    const type = detectLegacyCellType(initialData, !!activeProject);

    // Parse legacy staff names from flat text
    let parsedStaff = initialData.staff ?? [];
    if (!initialData.staff && initialData.text && type === 'shift') {
      const exclude = new Set(['Выходной', 'СТОП', 'Нет', 'ОТМЕНА', 'СМЕНЫ', 'СВОИ', 'ЛИЦЕМЕРЫ', 'Фестиваль']);
      parsedStaff = Array.from(
        new Set(
          initialData.text
            .split(/[\s/(),[|\]]+/)
            .map(w => w.replace(/[^\p{L}]/gu, ''))
            .filter(w => w.length > 2 && /^\p{Lu}/u.test(w) && !exclude.has(w)),
        ),
      );
    }

    // Parse legacy car emoji from flat text
    let parsedCars = initialData.cars ?? [];
    if (!initialData.cars && initialData.text && type === 'shift') {
      const found = cars.find(c => {
        const emoji = c.label.match(/\p{Emoji}/u)?.[0];
        return emoji && initialData.text!.includes(emoji);
      });
      if (found) parsedCars = [found.label];
    }

    setData({
      ...initialData,
      cellType: type,
      projectId: initialData.projectId ?? '',
      comment: initialData.comment ?? '',
      projectName: initialData.projectName ?? (type === 'project_start' ? initialData.text : ''),
      staff: parsedStaff,
      cars: parsedCars,
      dayType: initialData.dayType ?? '',
      options: initialData.options ?? [],
    });
  }, [isOpen, initialData]); // intentionally excludes `cars`/`activeProject` — changes there must not reset an open form

  if (!isOpen) return null;

  // ─── Derived values (computed per render but cheap) ────────────────────────

  const availableTypes = activeProject
    ? [
        { val: 'shift', label: 'Смена' },
        { val: 'day_off', label: 'Выходной / Отсыпной' },
        { val: 'stop', label: 'Стоп (Закрыть проект)' },
      ]
    : [{ val: 'project_start', label: 'Старт проекта' }];

  const primaryColor = activeProject?.color ?? 'var(--primary-color)';
  const glowStyle = activeProject ? `0 0 20px ${activeProject.color}4D` : 'none';

  // ─── Handlers ─────────────────────────────────────────────────────────────

  const handleClear = () => setData({ cellType: '' });

  const handleAddStaff = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const val = e.target.value;
    if (!val || data.staff?.includes(val)) return;
    setData(prev => ({ ...prev, staff: [...(prev.staff ?? []), val] }));
    e.target.value = '';
  };

  const handleRemoveStaff = (name: string) =>
    setData(prev => ({ ...prev, staff: prev.staff?.filter(s => s !== name) }));

  const toggleCar = (label: string) =>
    setData(prev => {
      const current = prev.cars ?? [];
      return { ...prev, cars: current.includes(label) ? current.filter(c => c !== label) : [...current, label] };
    });

  const toggleOption = (opt: string) =>
    setData(prev => {
      const current = prev.options ?? [];
      return { ...prev, options: current.includes(opt) ? current.filter(c => c !== opt) : [...current, opt] };
    });

  const handleSave = () => {
    if (!data.cellType) { onSave({}); return; }

    if (data.cellType === 'shift' && !data.dayType) {
      alert('Пожалуйста, выберите локацию (натура, павильон и т.д.) для этой смены.');
      return;
    }

    let text = '';
    let color = data.color ?? '';

    if (data.cellType === 'project_start') {
      const proj = globalProjects.find(p => p.id === data.projectId);
      if (proj) {
        text = proj.name;
        color = proj.color;
      } else {
        alert('Пожалуйста, выберите проект из списка.');
        return;
      }
    } else if (data.cellType === 'stop') {
      text = 'СТОП';
    } else if (data.cellType === 'day_off') {
      text = data.dayType === 'отсыпной' ? 'Отсыпной' : 'Выходной';
    } else if (data.cellType === 'shift') {
      text = data.staff?.length ? data.staff.join(' ') : '';
      if (data.dayType) text += ` [${data.dayType}]`;
      if (data.options?.length) text += ` (${data.options.join(', ')})`;
      const carObj = cars.find(c => c.label === data.cars?.[0]);
      if (carObj) color = carObj.color;
    }

    onSave({ ...data, text, color });
  };

  // ─── Render ───────────────────────────────────────────────────────────────

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
          {/* Cell type selector */}
          {availableTypes.length > 1 && (
            <div className={styles.formGroup}>
              <label>Тип ячейки</label>
              <select
                className={styles.select}
                value={data.cellType || ''}
                onChange={e => setData({ cellType: e.target.value as any, projectName: data.projectName, color: data.color })}
              >
                <option value="" disabled>(Не выбран)</option>
                {availableTypes.map(t => <option key={t.val} value={t.val}>{t.label}</option>)}
              </select>
            </div>
          )}

          {/* project_start fields */}
          {data.cellType === 'project_start' && (
            <>
              <div className={styles.formGroup}>
                <label>Проект</label>
                <select
                  className={styles.select}
                  value={data.projectId || ''}
                  onChange={e => setData(prev => ({ ...prev, projectId: e.target.value }))}
                >
                  <option value="" disabled>(Выберите проект)</option>
                  {globalProjects.map(p => (
                    <option key={p.id} value={p.id}>{p.name}</option>
                  ))}
                </select>
              </div>
              <div className={styles.formGroup}>
                <label>Комментарий к проекту</label>
                <input
                  type="text"
                  className={styles.select}
                  style={{ width: '100%', padding: '8px', border: '1px solid var(--border-color)', borderRadius: '4px', background: 'var(--input-bg)', color: 'var(--text-primary)', boxSizing: 'border-box' }}
                  placeholder="Например, номер счёта, статус..."
                  value={data.comment || ''}
                  onChange={e => setData(prev => ({ ...prev, comment: e.target.value }))}
                />
              </div>
            </>
          )}

          {/* day_off sub-type */}
          {data.cellType === 'day_off' && (
            <div className={styles.formGroup}>
              <label>Тип выходного</label>
              <select
                className={styles.select}
                value={data.dayType || 'выходной'}
                onChange={e => setData(prev => ({ ...prev, dayType: e.target.value }))}
              >
                <option value="выходной">Выходной</option>
                <option value="отсыпной">Отсыпной</option>
              </select>
            </div>
          )}

          {/* shift fields */}
          {data.cellType === 'shift' && (
            <>
              <div className={styles.formGroup}>
                <label>Локация</label>
                <select
                  className={styles.select}
                  value={SHIFT_DAY_TYPES.includes(data.dayType as any) ? data.dayType : ''}
                  onChange={e => setData(prev => ({ ...prev, dayType: e.target.value }))}
                >
                  <option value="">(Не выбрано)</option>
                  {SHIFT_DAY_TYPES.map(dt => (
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
                      <input type="checkbox" checked={(data.cars ?? []).includes(car.label)} onChange={() => toggleCar(car.label)} />
                      {car.label}
                    </label>
                  ))}
                </div>
              </div>

              <div className={styles.formGroup}>
                <label>Доп. опции</label>
                <div className={styles.checkboxList}>
                  {EXTRA_OPTIONS.map(opt => (
                    <label key={opt} className={styles.checkboxLabel}>
                      <input type="checkbox" checked={(data.options ?? []).includes(opt)} onChange={() => toggleOption(opt)} />
                      {opt}
                    </label>
                  ))}
                </div>
              </div>
            </>
          )}
        </div>

        <div className={styles.footer} style={{ display: 'flex', flexDirection: 'row', alignItems: 'center', gap: '12px' }}>
          <button className={styles.cancelBtn} style={{ color: 'var(--danger-color)', marginRight: 'auto' }} onClick={handleClear}>Очистить</button>
          <button className={styles.cancelBtn} onClick={onClose}>Отмена</button>
          <button className={styles.saveBtn} style={{ backgroundColor: primaryColor }} onClick={handleSave}>Сохранить</button>
        </div>
      </div>
    </div>
  );
};
