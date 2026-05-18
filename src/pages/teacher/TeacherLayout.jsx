import React, { useEffect, useState } from 'react';
import { Link, useLocation, Outlet, useNavigate } from 'react-router-dom';
import { useAuth } from '@/lib/AuthContext';
import { base44 } from '@/api/base44Client';
import { BarChart2, Users, BookOpen, RefreshCw, ClipboardList, CheckSquare, Star, ChevronLeft, ChevronRight, Building2 } from 'lucide-react';
import { toast } from 'sonner';
import { TeacherProvider, useTeacher } from '@/lib/TeacherContext';
import UserMenuDropdown from '@/components/UserMenuDropdown';



function NavItem({ item, active, count }) {
  return (
    <Link to={item.path}
      className={`flex items-center gap-3 px-3 py-2.5 rounded-lg transition-colors text-sm ${
        active ? 'bg-violet-500 text-white' : 'hover:bg-white/10'
      }`}>
      <item.icon className="w-4 h-4" />
      <span className="flex-1">{item.label}</span>
      {count > 0 && (
        <span className="bg-amber-500 text-white text-xs px-1.5 py-0.5 rounded-full font-semibold min-w-[20px] text-center">
          {count}
        </span>
      )}
    </Link>
  );
}

function SidebarNav({ navItems, location }) {
  const { data } = useTeacher();
  const reviewCount = data?.review_request_count || 0;
  return (
    <nav className="flex flex-col gap-1 flex-1">
      {navItems.map(item => {
        const active = item.exact
          ? location.pathname === item.path
          : location.pathname.startsWith(item.path) && location.pathname !== '/teacher';
        const count = item.path === '/teacher/review' ? reviewCount : 0;
        return <NavItem key={item.path} item={item} active={active} count={count} />;
      })}
    </nav>
  );
}

function MobileNav({ navItems, location }) {
  const { data } = useTeacher();
  const reviewCount = data?.review_request_count || 0;
  return (
    <div className="flex items-center justify-around px-2 py-2">
      {navItems.map(item => {
        const active = item.exact
          ? location.pathname === item.path
          : location.pathname.startsWith(item.path);
        const count = item.path === '/teacher/review' ? reviewCount : 0;
        return (
          <Link key={item.path} to={item.path}
            className={`relative flex flex-col items-center gap-0.5 px-3 py-2 rounded-lg text-xs ${
              active ? 'text-violet-200' : 'text-violet-400'
            }`}>
            <item.icon className="w-4 h-4" />
            {item.label}
            {count > 0 && (
              <span className="absolute -top-0.5 -right-0.5 bg-amber-500 text-white text-[10px] px-1 py-0 rounded-full min-w-[14px] text-center font-semibold">
                {count}
              </span>
            )}
          </Link>
        );
      })}
    </div>
  );
}

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
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [ownerByAcademy, setOwnerByAcademy] = useState(false);

  useEffect(() => {
    if (!user?.id) return;
    (async () => {
      try {
        if (user.academy_id) {
          const [academy] = await base44.entities.Academy.filter({ id: user.academy_id }, '-created_date', 1);
          if (academy?.owner_id === user.id) { setOwnerByAcademy(true); return; }
        }
        const ownedAcademies = await base44.entities.Academy.filter({ owner_id: user.id }, '-created_date', 1);
        if (ownedAcademies.length > 0) setOwnerByAcademy(true);
      } catch {}
    })();
  }, [user?.id, user?.academy_id]);

  const isOwner = user?.role === 'owner' || ownerByAcademy;
  const TEACHER_NAV = [
    { path: '/teacher', icon: BarChart2, label: '대시보드', exact: true },
    { path: '/teacher/classes', icon: BookOpen, label: '내 학급' },
    ...(isOwner ? [{ path: '/teacher/academy', icon: Building2, label: '내 학원 관리' }] : []),
    { path: '/teacher/assignments', icon: ClipboardList, label: '숙제' },
    { path: '/teacher/review', icon: CheckSquare, label: '채점 검토' },
    { path: '/teacher/problems', icon: BookOpen, label: '문제' },
    { path: '/teacher/bookmarks', icon: Star, label: '즐겨찾기' },
  ];

  useEffect(() => {
    if (isLoadingAuth || !user) return;
    if (user.role === 'admin') {
      navigate('/admin', { replace: true });
    } else if (user.role !== 'teacher' && user.role !== 'owner') {
      toast.error('강사 또는 학원장 권한이 필요해요');
      navigate('/home', { replace: true });
    }
  }, [user, isLoadingAuth, navigate]);

  if (isLoadingAuth || !user) return null;
  if (user.role !== 'teacher' && user.role !== 'owner') return null;

  return (
    <TeacherProvider>
      <div className="min-h-screen bg-background flex flex-col">
        <header className="bg-violet-900 text-white px-4 py-3 flex items-center gap-3">
           <button onClick={() => setSidebarOpen(o => !o)} className="p-1 rounded-lg hover:bg-white/10 transition-colors hidden md:flex">
             {sidebarOpen ? <ChevronLeft className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
           </button>
           <div className="w-7 h-7 bg-violet-500 rounded-lg flex items-center justify-center">
             <span className="text-white text-xs font-bold">강</span>
           </div>
           <span className="font-bold flex-1">강사 패널</span>
           <RefreshButton />
           <UserMenuDropdown />
         </header>

        <div className="flex flex-1">
          {sidebarOpen && (
            <aside className="w-52 bg-violet-800 text-violet-100 flex flex-col py-4 px-3 hidden md:flex flex-shrink-0">
              <SidebarNav navItems={TEACHER_NAV} location={location} />
            </aside>
          )}

          {/* Mobile nav */}
          <div className="fixed bottom-0 left-0 right-0 z-40 md:hidden bg-violet-800 border-t border-violet-700">
            <MobileNav navItems={TEACHER_NAV} location={location} />
          </div>

          <main className="flex-1 overflow-auto p-6 pb-20 md:pb-6">
            <Outlet />
          </main>
        </div>
      </div>
    </TeacherProvider>
  );
}