import React, { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { apiClient } from '../../api/client';
import styles from './StaffView.module.css';

export const StaffView: React.FC = () => {
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token');
  const [data, setData] = useState<any>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!token) {
      setError('Недействительная ссылка. Отсутствует токен.');
      return;
    }

    apiClient.get(`/staff/schedule?token=${token}`)
      .then(res => setData(res.data))
      .catch(() => setError('Не удалось загрузить расписание. Ссылка устарела или неверна.'));
  }, [token]);

  if (error) {
    return <div className={styles.errorContainer}>{error}</div>;
  }

  if (!data) {
    return <div className={styles.loadingContainer}>Загрузка...</div>;
  }

  return (
    <div className={styles.container}>
      <header className={styles.header}>
        <div className={styles.brand}>Production Schedule</div>
        <div className={styles.staffName}>{data.staffName}</div>
      </header>
      <div className={styles.content}>
        <h2>Моё расписание</h2>
        {data.dates.map((d: any) => (
          <div key={d.date} className={styles.dateCard}>
            <div className={styles.dateHeader}>{d.date}</div>
            <div className={styles.tasks}>
              {Object.keys(d.data).map(colId => {
                const column = data.columns.find((c: any) => c.id === colId);
                const cell = d.data[colId];
                return (
                  <div key={colId} className={styles.taskItem}>
                    <span className={styles.projectName}>{column?.name}</span>
                    <span 
                      className={styles.taskCell} 
                      style={{ backgroundColor: cell.color || 'transparent' }}
                    >
                      {cell.text}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        ))}
        {data.dates.length === 0 && (
          <div className={styles.emptyState}>Нет активных задач в расписании</div>
        )}
      </div>
    </div>
  );
};
