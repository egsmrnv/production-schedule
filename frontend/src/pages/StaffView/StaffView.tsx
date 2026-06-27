import React, { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { apiClient } from '../../api/client';
import { DataGrid } from '../../components/Grid/DataGrid';
import { type ThemeSettings, DEFAULT_THEME } from '../../components/Grid/DesignSettingsModal';
import styles from './StaffView.module.css';

export const StaffView: React.FC = () => {
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token');
  const [error, setError] = useState('');
  const [themeSettings, setThemeSettings] = useState<ThemeSettings>(DEFAULT_THEME);
  const [staffName, setStaffName] = useState('');

  useEffect(() => {
    if (!token) {
      setError('Недействительная ссылка. Отсутствует токен.');
      return;
    }

    // Fetch theme settings for consistent styling
    apiClient.get('/settings').then(res => {
      if (res.data && Object.keys(res.data).length > 0) {
        setThemeSettings({ ...DEFAULT_THEME, ...res.data });
      }
    }).catch(console.error);

    // We can also fetch the staff name to display it in the header
    apiClient.get(`/staff/schedule?token=${token}`)
      .then(res => setStaffName(res.data.staffName))
      .catch(() => setError('Не удалось загрузить расписание. Ссылка устарела или неверна.'));

  }, [token]);

  if (error) {
    return <div className={styles.errorContainer}>{error}</div>;
  }

  if (!staffName) {
    return <div className={styles.loadingContainer}>Загрузка...</div>;
  }

  return (
    <div className={styles.container}>
      <header className={styles.header}>
        <div className={styles.brand}>Production Schedule</div>
        <div className={styles.staffName}>{staffName}</div>
      </header>
      <div className={styles.content} style={{ flex: 1, overflow: 'hidden', padding: '0', display: 'flex', flexDirection: 'column' }}>
        <DataGrid 
          readOnly={true}
          apiEndpoint={`/staff/schedule?token=${token}`}
          themeSettings={themeSettings}
        />
      </div>
    </div>
  );
};
