import React from 'react';
import { useNavigate, Navigate } from 'react-router-dom';
import styles from './AdminBoard.module.css';
import { DataGrid } from '../../components/Grid/DataGrid';

export const AdminBoard: React.FC = () => {
  const navigate = useNavigate();
  const token = localStorage.getItem('token');

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
        <aside className={styles.sidebar}>
          <div className={styles.sidebarSection}>
            <h3>Легенда</h3>
            <ul className={styles.legendList}>
              <li>⚫️ Белый спринтер</li>
              <li>🟢 Зеленый спринтер</li>
              <li>🟠 Оранжевый</li>
            </ul>
          </div>
          <div className={styles.sidebarSection}>
            <h3>Сотрудники</h3>
            <ul className={styles.staffList}>
              <li>
                <span>Иван Иванов</span>
                <button className={styles.copyLinkBtn}>Скопировать ссылку</button>
              </li>
            </ul>
          </div>
        </aside>
        <section className={styles.gridArea}>
          <DataGrid />
        </section>
      </div>
    </div>
  );
};
