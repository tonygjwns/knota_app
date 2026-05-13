import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import { base44 } from '@/api/base44Client';
import { useAuth } from './AuthContext';

const TeacherContext = createContext(null);

const CACHE_TTL_MS = 5 * 60 * 1000; // 5분

export function TeacherProvider({ children }) {
  const { user } = useAuth();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const loadedAtRef = useRef(null);

  const load = useCallback(async (force = false) => {
    if (!user || (user.role !== 'teacher' && user.role !== 'owner')) return;
    // TTL 캐시: 5분 내 재진입 시 스킵 (force 아닌 경우)
    if (!force && data && loadedAtRef.current) {
      const age = Date.now() - loadedAtRef.current;
      if (age < CACHE_TTL_MS) return;
    }
    setLoading(true);
    setError(null);
    try {
      const res = await base44.functions.invoke('teacherSummary', {});
      setData(res.data);
      loadedAtRef.current = Date.now();
    } catch (e) {
      setError(e.message || '데이터를 불러오지 못했어요');
    } finally {
      setLoading(false);
    }
  }, [user?.id]);

  useEffect(() => { load(); }, [load]);

  return (
    <TeacherContext.Provider value={{ data, loading, error, refresh: () => load(true) }}>
      {children}
    </TeacherContext.Provider>
  );
}

export function useTeacher() {
  return useContext(TeacherContext);
}