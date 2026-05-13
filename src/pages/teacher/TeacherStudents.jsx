import React from 'react';
import { Navigate } from 'react-router-dom';

// /teacher/students → /teacher/classes 로 redirect
// 학생 상세(/teacher/students/:id)는 별도 라우트이므로 영향 없음
export default function TeacherStudents() {
  return <Navigate to="/teacher/classes" replace />;
}