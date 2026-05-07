import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { base44 } from '@/api/base44Client';
import { useAuth } from '@/lib/AuthContext';

const TeacherContext = createContext(null);

export function TeacherProvider({ children }) {
  const { user } = useAuth();
  const [myClasses, setMyClasses] = useState([]);
  const [students, setStudents] = useState([]);
  const [attempts, setAttempts] = useState([]);
  const [academies, setAcademies] = useState([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!user) return;
    setLoading(true);

    // Step 1: fetch only my classes (small table — filter client-side is fine)
    const [allClasses, acad] = await Promise.all([
      base44.entities.Class.list('name', 500),
      base44.entities.Academy.list('name', 200),
    ]);

    const mine = allClasses.filter(c =>
      c.main_teacher_id === user.id ||
      (c.assistant_teacher_ids || []).includes(user.id)
    );
    setMyClasses(mine);
    setAcademies(acad);

    if (mine.length === 0) {
      setStudents([]);
      setAttempts([]);
      setLoading(false);
      return;
    }

    const myClassIds = mine.map(c => c.id);

    // Step 2: fetch only students in my classes using filter (one class at a time if needed)
    // base44 filter supports single value — fetch per class and merge
    const studentFetches = myClassIds.map(cid =>
      base44.entities.User.filter({ class_id: cid }, '-created_date', 200)
    );
    const studentArrays = await Promise.all(studentFetches);
    const myStudents = studentArrays.flat();
    // deduplicate by id
    const seen = new Set();
    const uniqueStudents = myStudents.filter(u => seen.has(u.id) ? false : seen.add(u.id));
    setStudents(uniqueStudents);

    if (uniqueStudents.length === 0) {
      setAttempts([]);
      setLoading(false);
      return;
    }

    // Step 3: fetch attempts per student (batched in parallel, up to 20 at a time)
    const studentIds = uniqueStudents.map(u => u.id);
    const BATCH = 20;
    const batches = [];
    for (let i = 0; i < studentIds.length; i += BATCH) {
      batches.push(studentIds.slice(i, i + BATCH));
    }
    const attemptArrays = await Promise.all(
      batches.map(batch =>
        Promise.all(batch.map(sid =>
          base44.entities.StudentAttempt.filter({ student_id: sid }, '-submitted_at', 200)
        ))
      )
    );
    const allAttempts = attemptArrays.flat(2);
    setAttempts(allAttempts);
    setLoading(false);
  }, [user]);

  useEffect(() => { load(); }, [load]);

  return (
    <TeacherContext.Provider value={{ myClasses, students, attempts, academies, loading, reload: load }}>
      {children}
    </TeacherContext.Provider>
  );
}

export function useTeacher() {
  return useContext(TeacherContext);
}