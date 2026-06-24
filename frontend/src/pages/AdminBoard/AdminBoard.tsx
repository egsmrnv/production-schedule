import React, { useState, useCallback } from 'react';
import { useNavigate, Navigate } from 'react-router-dom';
import { apiClient } from '../../api/client';
import styles from './AdminBoard.module.css';
import { DataGrid } from '../../components/Grid/DataGrid';

export const AdminBoard: React.FC = () => {
  const navigate = useNavigate();
  const token = localStorage.getItem('token');

  const [staffList, setStaffList] = useState<any[]>([]);
  const [projects, setProjects] = useState<any[]>([]);
  const [cars, setCars] = useState<any[]>([]);
  const [highlight, setHighlight] = useState<{ text?: string, color?: string, columnId?: string }>({});

  const fetchData = useCallback(async () => {
    try {
      const [staffRes, carsRes] = await Promise.all([
        apiClient.get('/admin/staff'),
        apiClient.get('/admin/cars')
      ]);
      setStaffList(staffRes.data);
      setCars(carsRes.data);
    } catch (e) {
      console.error(e);
    }
  }, []);

  React.useEffect(() => {
    if (token) fetchData();
  }, [token, fetchData]);

  const handleDataLoaded = useCallback((cols: any[]) => {
    setProjects(cols.filter(c => c.id !== 'date'));
  }, []);

  if (!token) {
    return <Navigate to="/login" replace />;
  }

  const handleLogout = () => {
    localStorage.removeItem('token');
    navigate('/login');
  };

  const handleAddStaff = async () => {
    const name = prompt('Имя сотрудника:');
    if (!name) return;
    await apiClient.post('/admin/staff', { name });
    fetchData();
  };

  const handleDeleteStaff = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!window.confirm('Точно удалить сотрудника? Он будет стерт из всей истории.')) return;
    await apiClient.delete(`/admin/staff/${id}`);
    fetchData();
  };

  const handleAddCar = async () => {
    const label = prompt('Название машины (желательно с эмодзи):');
    if (!label) return;
    const color = prompt('Цвет фона ячейки (например #cccccc):', '#cccccc');
    await apiClient.post('/admin/cars', { label, color });
    fetchData();
  };

  const handleDeleteCar = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!window.confirm('Точно удалить машину?')) return;
    await apiClient.delete(`/admin/cars/${id}`);
    fetchData();
  };

  const handleAddProject = async () => {
    const name = prompt('Название проекта:');
    if (!name) return;
    await apiClient.post('/columns', { name, order: projects.length });
    window.location.reload();
  };

  const handleDeleteProject = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!window.confirm('Точно удалить проект? Все данные колонки будут утеряны.')) return;
    await apiClient.delete(`/columns/${id}`);
    window.location.reload();
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
            staffList={staffList.map(s => s.name)}
            cars={cars}
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
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h3>Машины</h3>
              <button onClick={handleAddCar} style={{ fontSize: '16px', color: 'var(--primary-color)' }}>➕</button>
            </div>
            <ul className={styles.legendList}>
              {cars.map(c => (
                <li 
                  key={c.id}
                  style={{ cursor: 'pointer', opacity: highlight.color === c.color ? 1 : 0.7 }}
                  onClick={() => setHighlight({ color: c.color })}
                >
                  <span style={{flex: 1}}>{c.label}</span>
                  <button onClick={(e) => handleDeleteCar(c.id, e)} style={{ color: 'var(--danger-color)', padding: '0 5px' }}>🗑</button>
                </li>
              ))}
            </ul>
          </div>

          <div className={styles.sidebarSection}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h3>Проекты</h3>
              <button onClick={handleAddProject} style={{ fontSize: '16px', color: 'var(--primary-color)' }}>➕</button>
            </div>
            <ul className={styles.legendList}>
              {projects.map(p => (
                <li 
                  key={p.id} 
                  style={{ cursor: 'pointer', opacity: highlight.columnId === p.id ? 1 : 0.7 }}
                  onClick={() => setHighlight({ columnId: p.id })}
                >
                  <span style={{flex: 1}}>{p.name}</span>
                  <button onClick={(e) => handleDeleteProject(p.id, e)} style={{ color: 'var(--danger-color)', padding: '0 5px' }}>🗑</button>
                </li>
              ))}
            </ul>
          </div>

          <div className={styles.sidebarSection}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h3>Сотрудники</h3>
              <button onClick={handleAddStaff} style={{ fontSize: '16px', color: 'var(--primary-color)' }}>➕</button>
            </div>
            <ul className={styles.staffList}>
              {staffList.map(s => (
                <li 
                  key={s.id}
                  style={{ cursor: 'pointer', backgroundColor: highlight.text === s.name ? 'var(--cell-selected)' : 'transparent' }}
                  onClick={() => setHighlight({ text: s.name })}
                >
                  <span style={{flex: 1}}>{s.name}</span>
                  <button onClick={(e) => handleDeleteStaff(s.id, e)} style={{ color: 'var(--danger-color)', padding: '0 5px' }}>🗑</button>
                </li>
              ))}
            </ul>
          </div>
        </aside>
      </div>
    </div>
  );
};
