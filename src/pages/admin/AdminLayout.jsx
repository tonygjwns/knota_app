import React, { useEffect } from 'react';
import { Link, useLocation, Outlet, useNavigate } from 'react-router-dom';
import { base44 } from '@/api/base44Client';
import { useAuth } from '@/lib/AuthContext';
import { Users, BookOpen, BarChart2, Building, GraduationCap } from 'lucide-react';
import { toast } from 'sonner';
import UserMenuDropdown from '@/components/UserMenuDropdown';

const ADMIN_NAV = [
  { path: '/admin', icon: BarChart2, label: '대시보드', exact: true },
  { path: '/admin/academies', icon: Building, label: '학원/학급' },
  { path: '/admin/teachers', icon: GraduationCap, label: '강사' },
  { path: '/admin/students', icon: Users, label: '학생' },
  { path: '/admin/problems', icon: BookOpen, label: '문제' },

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
         <UserMenuDropdown />
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

        </aside>

        {/* Mobile admin nav — split into 2 rows if too many items */}
        <div className="fixed bottom-0 left-0 right-0 z-40 md:hidden bg-slate-800 border-t border-slate-700">
          <div className="flex items-center justify-around px-1 py-1.5 flex-wrap">
            {ADMIN_NAV.map(item => {
                const active = item.exact
                  ? location.pathname === item.path
                  : location.pathname.startsWith(item.path);
                return (
                  <Link key={item.path} to={item.path}
                        className={`flex flex-col items-center gap-0.5 px-2 py-1.5 rounded-lg text-xs min-w-[48px] ${
                          active ? 'text-primary' : 'text-slate-400'
                        }`}>
                    <item.icon className="w-4 h-4" />
                    <span className="text-[10px]">{item.label}</span>
                  </Link>
                );
              })}
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