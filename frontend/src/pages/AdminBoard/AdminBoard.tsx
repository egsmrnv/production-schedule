import React, { useState, useCallback, useRef } from 'react';
import { useNavigate, Navigate } from 'react-router-dom';
import { apiClient } from '../../api/client';
import styles from './AdminBoard.module.css';
import { DataGrid } from '../../components/Grid/DataGrid';
import { DesignSettingsModal, type ThemeSettings, DEFAULT_THEME } from '../../components/Grid/DesignSettingsModal';
import { ProjectSettingsModal, type ProjectData } from '../../components/Grid/ProjectSettingsModal';
import { AddEquipmentModal } from '../../components/Grid/AddEquipmentModal';

export const AdminBoard: React.FC = () => {
  const navigate = useNavigate();
  const token = localStorage.getItem('token');
  const gridRef = useRef<{ addColumn: () => void } | null>(null);

  const [staffList, setStaffList] = useState<any[]>([]);
  const [globalProjects, setGlobalProjects] = useState<ProjectData[]>([]);
  const [cars, setCars] = useState<any[]>([]);
  const [highlight, setHighlight] = useState<{ text?: string, color?: string, columnId?: string }>({});
  
  const [themeSettings, setThemeSettings] = useState<ThemeSettings>(DEFAULT_THEME);
  const [isDesignModalOpen, setIsDesignModalOpen] = useState(false);
  const [isProjectModalOpen, setIsProjectModalOpen] = useState(false);
  const [isAddEquipmentModalOpen, setIsAddEquipmentModalOpen] = useState(false);
  const [editingProject, setEditingProject] = useState<ProjectData | null>(null);
  const [collapsed, setCollapsed] = useState({ cars: false, projects: false, staff: false });

  const toggleCollapse = (key: 'cars' | 'projects' | 'staff') => {
    setCollapsed(prev => ({ ...prev, [key]: !prev[key] }));
  };

  const fetchData = useCallback(async () => {
    try {
      const [staffRes, carsRes, settingsRes, projectsRes] = await Promise.all([
        apiClient.get('/admin/staff'),
        apiClient.get('/admin/cars'),
        apiClient.get('/settings'),
        apiClient.get('/admin/projects')
      ]);
      setStaffList(staffRes.data);
      setCars(carsRes.data);
      setGlobalProjects(projectsRes.data);
      if (settingsRes.data && Object.keys(settingsRes.data).length > 0) {
        setThemeSettings({ ...DEFAULT_THEME, ...settingsRes.data });
      }
    } catch (e) {
      console.error(e);
    }
  }, []);

  React.useEffect(() => {
    if (token) fetchData();
  }, [token, fetchData]);

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

  const handleDeleteStaff = async (id: string) => {
    if (!window.confirm('Точно удалить сотрудника? Он будет стерт из всей истории.')) return;
    await apiClient.delete(`/admin/staff/${id}`);
    if (highlight.text === staffList.find(s => s.id === id)?.name) {
      setHighlight({});
    }
    fetchData();
  };

  const handleAddCar = () => {
    setIsAddEquipmentModalOpen(true);
  };

  const handleSaveEquipment = async (emoji: string, name: string, color: string) => {
    const label = `${emoji} ${name}`;
    await apiClient.post('/admin/cars', { label, color });
    setIsAddEquipmentModalOpen(false);
    fetchData();
  };

  const handleDeleteCar = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!window.confirm('Точно удалить технику?')) return;
    await apiClient.delete(`/admin/cars/${id}`);
    fetchData();
  };

  const handleAddProject = () => {
    setEditingProject(null);
    setIsProjectModalOpen(true);
  };

  const handleSaveProject = async (project: ProjectData) => {
    if (project.id) {
      await apiClient.put(`/admin/projects/${project.id}`, project);
    } else {
      await apiClient.post('/admin/projects', project);
    }
    setIsProjectModalOpen(false);
    fetchData();
  };

  const handleDeleteProject = async (id: string) => {
    await apiClient.delete(`/admin/projects/${id}`);
    setIsProjectModalOpen(false);
    fetchData();
  };

  const handleSaveDesign = async (newSettings: ThemeSettings) => {
    try {
      await apiClient.put('/settings', newSettings);
      setThemeSettings(newSettings);
      setIsDesignModalOpen(false);
    } catch (error) {
      console.error(error);
      alert('Ошибка при сохранении настроек');
    }
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
            gridRef={gridRef}
            highlightText={highlight.text}
            highlightColor={highlight.color}
            highlightColumnId={highlight.columnId}
            staffList={staffList.map(s => s.name)}
            cars={cars}
            globalProjects={globalProjects}
            themeSettings={themeSettings}
          />
        </section>
        <aside className={styles.sidebar}>
          {/* Top highlight bar removed */}
          
          <div className={styles.sidebarSection}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', cursor: 'pointer' }} onClick={() => toggleCollapse('cars')}>
              <h3 style={{ margin: 0 }}>Техника {collapsed.cars ? '▼' : '▲'}</h3>
              <button onClick={(e) => { e.stopPropagation(); handleAddCar(); }} style={{ fontSize: '16px', color: 'var(--primary-color)' }}>➕</button>
            </div>
            {!collapsed.cars && (
              <ul className={styles.legendList} style={{ marginTop: '10px' }}>
                {cars.map(c => (
                  <li 
                    key={c.id}
                    style={{ cursor: 'pointer', opacity: highlight.color === c.color ? 1 : 0.7 }}
                    onClick={() => setHighlight(highlight.color === c.color ? {} : { color: c.color })}
                  >
                    <span style={{flex: 1}}>{c.label}</span>
                    <button onClick={(e) => handleDeleteCar(c.id, e)} style={{ color: 'var(--danger-color)', padding: '0 5px' }}>🗑</button>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div className={styles.sidebarSection}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', cursor: 'pointer' }} onClick={() => toggleCollapse('projects')}>
              <h3 style={{ margin: 0 }}>Проекты {collapsed.projects ? '▼' : '▲'}</h3>
              <button onClick={(e) => { e.stopPropagation(); handleAddProject(); }} style={{ fontSize: '16px', color: 'var(--primary-color)' }}>➕</button>
            </div>
            {!collapsed.projects && (
              <ul className={styles.legendList} style={{ marginTop: '10px' }}>
                {globalProjects.map(p => (
                  <li 
                    key={p.id} 
                    style={{ cursor: 'pointer', borderLeft: `4px solid ${p.color}`, paddingLeft: '8px' }}
                    onClick={() => { setEditingProject(p); setIsProjectModalOpen(true); }}
                  >
                    <span style={{flex: 1}}>{p.name}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div className={styles.sidebarSection}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', cursor: 'pointer' }} onClick={() => toggleCollapse('staff')}>
              <h3 style={{ margin: 0 }}>Сотрудники {collapsed.staff ? '▼' : '▲'}</h3>
              <button onClick={(e) => { e.stopPropagation(); handleAddStaff(); }} style={{ fontSize: '16px', color: 'var(--primary-color)' }}>➕</button>
            </div>
            {!collapsed.staff && (
              <ul className={styles.staffList} style={{ marginTop: '10px' }}>
                {staffList.map(s => (
                    <li 
                      key={s.id}
                      style={{ cursor: 'pointer', backgroundColor: highlight.text === s.name ? 'var(--cell-selected)' : 'transparent', display: 'flex', alignItems: 'center' }}
                      onClick={() => setHighlight(highlight.text === s.name ? {} : { text: s.name })}
                    >
                      <span style={{flex: 1}}>{s.name}</span>
                      <button 
                        onClick={(e) => {
                          e.stopPropagation();
                          const url = `${window.location.origin}/my-calendar?token=${s.accessToken}`;
                          navigator.clipboard.writeText(url);
                          window.open(url, '_blank');
                        }} 
                        style={{ color: 'var(--text-secondary)', padding: '0 5px', border: 'none', background: 'transparent', cursor: 'pointer' }}
                        title="Скопировать и открыть ссылку"
                      >
                        🔗
                      </button>
                      {highlight.text === s.name && (
                        <button 
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDeleteStaff(s.id);
                          }} 
                          style={{ color: 'var(--danger-color)', padding: '0 5px', border: 'none', background: 'transparent', cursor: 'pointer' }}
                          title="Удалить сотрудника"
                        >
                          🗑
                        </button>
                      )}
                    </li>
                ))}
              </ul>
            )}
          </div>
          
          <div className={styles.sidebarSection} style={{ marginTop: 'auto', borderTop: '1px solid var(--border-color)', paddingTop: '15px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
            <button 
              onClick={() => setIsDesignModalOpen(true)}
              style={{ width: '100%', padding: '10px', backgroundColor: 'var(--cell-bg)', border: '1px solid var(--border-color)', borderRadius: '6px', color: 'var(--text-primary)', cursor: 'pointer' }}
            >
              🎨 Настройки дизайна
            </button>
            <button 
              onClick={() => gridRef.current?.addColumn()}
              style={{ width: '100%', padding: '10px', backgroundColor: 'var(--cell-bg)', border: '1px solid var(--border-color)', borderRadius: '6px', color: 'var(--text-primary)', cursor: 'pointer' }}
            >
              ➕ Добавить столбец
            </button>
          </div>
        </aside>
      </div>
      
      <DesignSettingsModal 
        isOpen={isDesignModalOpen} 
        onClose={() => setIsDesignModalOpen(false)}
        initialSettings={themeSettings}
        onSave={handleSaveDesign}
      />
      
      <ProjectSettingsModal
        isOpen={isProjectModalOpen}
        project={editingProject}
        onClose={() => setIsProjectModalOpen(false)}
        onSave={handleSaveProject}
        onDelete={handleDeleteProject}
      />
      
      <AddEquipmentModal
        isOpen={isAddEquipmentModalOpen}
        onClose={() => setIsAddEquipmentModalOpen(false)}
        onSave={handleSaveEquipment}
      />
    </div>
  );
};
