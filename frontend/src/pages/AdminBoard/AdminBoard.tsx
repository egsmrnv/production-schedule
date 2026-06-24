import React, { useState, useCallback } from 'react';
import { useNavigate, Navigate } from 'react-router-dom';
import styles from './AdminBoard.module.css';
import { DataGrid } from '../../components/Grid/DataGrid';

export const AdminBoard: React.FC = () => {
  const navigate = useNavigate();
  const token = localStorage.getItem('token');

  const [staffList, setStaffList] = useState<string[]>([]);
  const [projects, setProjects] = useState<any[]>([]);
  
  const cars = [
    { label: '⬛️ Белый крафтер', color: '#cccccc' },
    { label: '⚫️ Белый спринтер', color: '#000000' }, // #cccccc is mostly used for grey, let's keep exact string match or generic mapping
    { label: '🟢 Зеленый спринтер', color: '#b6d7a8' },
    { label: '🟠 Оранжевый', color: '#fce5cd' }, // or #f6b26b, let's use the one from Google sheet
  ];
  // Wait, let's just use exact colors mapped from the CSS parsing earlier: 
  // #cccccc -> Grey/White sprinter
  // #b6d7a8 -> Green sprinter
  // #fff2cc or #fce5cd -> Orange. Let's just bind to specific names.
  
  const [highlight, setHighlight] = useState<{ text?: string, color?: string, columnId?: string }>({});

  const handleDataLoaded = useCallback((cols: any[], rows: any[]) => {
    // Extract Projects (columns except date)
    const projs = cols.filter(c => c.id !== 'date');
    setProjects(projs);

    // Extract Staff
    const staffSet = new Set<string>();
    const exclude = ['Выходной', 'СТОП', 'Нет', 'ОТМЕНА', 'СМЕНЫ', 'СВОИ'];
    rows.forEach(r => {
      Object.values(r.data).forEach((cell: any) => {
        if (cell.text) {
          const words = cell.text.split(/[\s/()]+/);
          words.forEach((w: string) => {
            if (w.length > 2 && !exclude.includes(w)) {
              staffSet.add(w);
            }
          });
        }
      });
    });
    setStaffList(Array.from(staffSet).sort());
  }, []);

  if (!token) {
    return <Navigate to="/login" replace />;
  }

  const handleLogout = () => {
    localStorage.removeItem('token');
    navigate('/login');
  };

  return (
    <div className={styles.container}>
      <header className={styles.header}>
        <div className={styles.brand}>Production Schedule</div>
        <button className={styles.logoutBtn} onClick={handleLogout}>Выйти</button>
      </header>
      <div className={styles.main}>
        <section className={styles.gridArea}>
          <DataGrid 
            onDataLoaded={handleDataLoaded}
            highlightText={highlight.text}
            highlightColor={highlight.color}
            highlightColumnId={highlight.columnId}
          />
        </section>
        <aside className={styles.sidebar}>
          {(highlight.text || highlight.color || highlight.columnId) && (
            <div className={styles.sidebarSection}>
              <button 
                onClick={() => setHighlight({})} 
                style={{ width: '100%', padding: '8px', background: 'var(--primary-color)', color: '#fff', border: 'none', borderRadius: '4px', cursor: 'pointer' }}
              >
                Сбросить выделение
              </button>
            </div>
          )}
          
          <div className={styles.sidebarSection}>
            <h3>Машины</h3>
            <ul className={styles.legendList}>
              <li 
                style={{ cursor: 'pointer', opacity: highlight.color === '#cccccc' ? 1 : 0.7 }}
                onClick={() => setHighlight({ color: '#cccccc' })}
              >
                ⬛️/⚫️ Белый спринтер/крафтер
              </li>
              <li 
                style={{ cursor: 'pointer', opacity: highlight.color === '#b6d7a8' ? 1 : 0.7 }}
                onClick={() => setHighlight({ color: '#b6d7a8' })}
              >
                🟢 Зеленый спринтер
              </li>
              <li 
                style={{ cursor: 'pointer', opacity: highlight.color === '#fff2cc' ? 1 : 0.7 }}
                onClick={() => setHighlight({ color: '#fff2cc' })}
              >
                🟠 Оранжевый
              </li>
            </ul>
          </div>

          <div className={styles.sidebarSection}>
            <h3>Проекты</h3>
            <ul className={styles.legendList}>
              {projects.map(p => (
                <li 
                  key={p.id} 
                  style={{ cursor: 'pointer', opacity: highlight.columnId === p.id ? 1 : 0.7 }}
                  onClick={() => setHighlight({ columnId: p.id })}
                >
                  {p.name}
                </li>
              ))}
            </ul>
          </div>

          <div className={styles.sidebarSection}>
            <h3>Сотрудники</h3>
            <ul className={styles.staffList}>
              {staffList.map(name => (
                <li 
                  key={name}
                  style={{ cursor: 'pointer', backgroundColor: highlight.text === name ? 'var(--cell-selected)' : 'transparent' }}
                  onClick={() => setHighlight({ text: name })}
                >
                  <span>{name}</span>
                </li>
              ))}
            </ul>
          </div>
        </aside>
      </div>
    </div>
  );
};
