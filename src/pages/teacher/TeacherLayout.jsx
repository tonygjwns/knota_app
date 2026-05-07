import React, { useEffect } from 'react';
import { Link, useLocation, Outlet, useNavigate } from 'react-router-dom';
import { useAuth } from '@/lib/AuthContext';
import { base44 } from '@/api/base44Client';
import { BarChart2, Users, BookOpen, RefreshCw, ClipboardList } from 'lucide-react';
import { toast } from 'sonner';
import { TeacherProvider, useTeacher } from '@/lib/TeacherContext';
import UserMenuDropdown from '@/components/UserMenuDropdown';

const TEACHER_NAV = [
  { path: '/teacher', icon: BarChart2, label: '대시보드', exact: true },
  { path: '/teacher/students', icon: Users, label: '내 학생들' },
  { path: '/teacher/classes', icon: BookOpen, label: '내 학급' },
  { path: '/teacher/assignments', icon: ClipboardList, label: '숙제' },
];

function RefreshButton() {
  const { refresh, loading } = useTeacher();
  return (
    <button
      onClick={refresh}
      disabled={loading}
      title="데이터 새로고침"
      className="p-1.5 rounded-lg hover:bg-white/10 text-violet-200 transition-colors disabled:opacity-40">
      <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
    </button>
  );
}

export default function TeacherLayout() {
  const location = useLocation();
  const navigate = useNavigate();
  const { user, isLoadingAuth } = useAuth();

  useEffect(() => {
    if (isLoadingAuth || !user) return;
    if (user.role === 'admin') {
      toast.error('강사만 접근 가능해요');
      navigate('/admin', { replace: true });
    } else if (user.role !== 'teacher') {
      toast.error('강사 권한이 필요해요');
      navigate('/home', { replace: true });
    }
  }, [user, isLoadingAuth, navigate]);

  if (isLoadingAuth || !user) return null;
  if (user.role !== 'teacher') return null;

  return (
    <TeacherProvider>
      <div className="min-h-screen bg-background flex flex-col">
        <header className="bg-violet-900 text-white px-4 py-3 flex items-center gap-3">
           <div className="w-7 h-7 bg-violet-500 rounded-lg flex items-center justify-center">
             <span className="text-white text-xs font-bold">강</span>
           </div>
           <span className="font-bold flex-1">강사 패널</span>
           <RefreshButton />
           <UserMenuDropdown />
         </header>

        <div className="flex flex-1">
          <aside className="w-52 bg-violet-800 text-violet-100 flex flex-col py-4 px-3 hidden md:flex">
            <nav className="flex flex-col gap-1 flex-1">
              {TEACHER_NAV.map(item => {
                const active = item.exact
                  ? location.pathname === item.path
                  : location.pathname.startsWith(item.path) && location.pathname !== '/teacher';
                return (
                  <Link key={item.path} to={item.path}
                    className={`flex items-center gap-3 px-3 py-2.5 rounded-lg transition-colors text-sm ${
                      active ? 'bg-violet-500 text-white' : 'hover:bg-white/10'
                    }`}>
                    <item.icon className="w-4 h-4" />
                    {item.label}
                  </Link>
                );
              })}
            </nav>

          </aside>

          {/* Mobile nav */}
          <div className="fixed bottom-0 left-0 right-0 z-40 md:hidden bg-violet-800 border-t border-violet-700">
            <div className="flex items-center justify-around px-2 py-2">
              {TEACHER_NAV.map(item => {
                const active = item.exact
                  ? location.pathname === item.path
                  : location.pathname.startsWith(item.path);
                return (
                  <Link key={item.path} to={item.path}
                    className={`flex flex-col items-center gap-0.5 px-3 py-2 rounded-lg text-xs ${
                      active ? 'text-violet-200' : 'text-violet-400'
                    }`}>
                    <item.icon className="w-4 h-4" />
                    {item.label}
                  </Link>
                );
              })}
            </div>
          </div>

          <main className="flex-1 overflow-auto p-6 pb-20 md:pb-6">
            <Outlet />
          </main>
        </div>
      </div>
    </TeacherProvider>
  );
}