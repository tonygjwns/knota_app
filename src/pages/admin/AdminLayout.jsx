import React, { useEffect } from 'react';
import { Link, useLocation, Outlet, useNavigate } from 'react-router-dom';
import { base44 } from '@/api/base44Client';
import { useAuth } from '@/lib/AuthContext';
import { Users, BookOpen, CheckSquare, BarChart2, Building, GraduationCap, UserCheck } from 'lucide-react';
import { toast } from 'sonner';

const ADMIN_NAV = [
  { path: '/admin', icon: BarChart2, label: '대시보드', exact: true },
  { path: '/admin/academies', icon: Building, label: '학원/학급' },
  { path: '/admin/teachers', icon: GraduationCap, label: '강사 목록' },
  { path: '/admin/students', icon: Users, label: '학생 목록' },
  { path: '/admin/problems', icon: BookOpen, label: '문제 목록' },
  { path: '/admin/review', icon: CheckSquare, label: '채점 검토' },
];

export default function AdminLayout() {
  const location = useLocation();
  const navigate = useNavigate();
  const { user, isLoadingAuth } = useAuth();

  useEffect(() => {
    if (!isLoadingAuth && user && user.role !== 'admin') {
      toast.error('관리자 권한이 필요해요');
      navigate('/home', { replace: true });
    }
  }, [user, isLoadingAuth, navigate]);

  if (isLoadingAuth || !user) return null;
  if (user.role !== 'admin') return null;

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Admin top bar */}
      <header className="bg-slate-900 text-white px-4 py-3 flex items-center gap-3">
        <div className="w-7 h-7 bg-primary rounded-lg flex items-center justify-center">
          <span className="text-white text-xs font-bold">관</span>
        </div>
        <span className="font-bold flex-1">관리자 패널</span>
        <span className="text-sm text-slate-300 truncate max-w-[160px]">{user.full_name || user.email}</span>
      </header>

      <div className="flex flex-1">
        {/* Sidebar */}
        <aside className="w-52 bg-slate-800 text-slate-100 flex flex-col py-4 px-3 hidden md:flex">
          <nav className="flex flex-col gap-1 flex-1">
            {ADMIN_NAV.map(item => {
              const active = item.exact
                ? location.pathname === item.path
                : location.pathname.startsWith(item.path) && location.pathname !== '/admin';
              return (
                <Link
                  key={item.path}
                  to={item.path}
                  className={`flex items-center gap-3 px-3 py-2.5 rounded-lg transition-colors text-sm ${
                    active ? 'bg-primary text-white' : 'hover:bg-white/10'
                  }`}>
                  <item.icon className="w-4 h-4" />
                  {item.label}
                </Link>
              );
            })}
          </nav>
          {/* User info + logout */}
          <div className="mt-auto pt-3 border-t border-slate-700 space-y-2">
            <div className="px-3 py-2 bg-slate-700 rounded-lg">
              <p className="text-sm font-medium truncate">{user.full_name || '(이름 없음)'}</p>
              <p className="text-xs text-slate-400 truncate">{user.email}</p>
              <span className="inline-block mt-1 text-xs px-2 py-0.5 rounded-full bg-purple-600 text-white">관리자</span>
            </div>
            <button
              onClick={() => base44.auth.logout('/')}
              className="w-full flex items-center gap-2 px-3 py-2 rounded-lg hover:bg-white/10 text-slate-300 text-sm transition-colors">
              로그아웃
            </button>
          </div>
        </aside>

        {/* Mobile admin nav */}
        <div className="fixed bottom-0 left-0 right-0 z-40 md:hidden bg-slate-800 border-t border-slate-700">
          <div className="flex items-center justify-around px-1 py-2">
            {ADMIN_NAV.map(item => {
              const active = item.exact
                ? location.pathname === item.path
                : location.pathname.startsWith(item.path);
              return (
                <Link key={item.path} to={item.path}
                      className={`flex flex-col items-center gap-0.5 px-2 py-1.5 rounded-lg text-xs ${
                        active ? 'text-primary' : 'text-slate-400'
                      }`}>
                  <item.icon className="w-4 h-4" />
                  <span className="text-[10px]">{item.label}</span>
                </Link>
              );
            })}
            <button onClick={() => base44.auth.logout('/')}
              className="flex flex-col items-center gap-0.5 px-2 py-1.5 rounded-lg text-xs text-slate-400">
              <span className="w-4 h-4 flex items-center justify-center">↩</span>
              <span className="text-[10px]">로그아웃</span>
            </button>
          </div>
        </div>

        {/* Content */}
        <main className="flex-1 overflow-auto p-6 pb-20 md:pb-6">
          <Outlet />
        </main>
      </div>
    </div>
  );
}