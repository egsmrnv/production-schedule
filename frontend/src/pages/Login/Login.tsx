import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { apiClient } from '../../api/client';
import styles from './Login.module.css';

export const Login: React.FC = () => {
  const [name, setName] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const res = await apiClient.post('/auth/login', { name, password });
      localStorage.setItem('token', res.data.token);
      navigate('/admin');
    } catch (err) {
      setError('Неверное имя пользователя или пароль');
    }
  };

  return (
    <div className={styles.container}>
      <div className={styles.card}>
        <h2 className={styles.title}>Production Schedule</h2>
        <form onSubmit={handleSubmit} className={styles.form}>
          {error && <div className={styles.error}>{error}</div>}
          <div className={styles.field}>
            <label>Имя пользователя</label>
            <input 
              type="text" 
              value={name} 
              onChange={e => setName(e.target.value)}
              required 
            />
          </div>
          <div className={styles.field}>
            <label>Пароль</label>
            <input 
              type="password" 
              value={password} 
              onChange={e => setPassword(e.target.value)}
              required 
            />
          </div>
          <button type="submit" className={styles.submitBtn}>Войти</button>
        </form>
      </div>
    </div>
  );
};
