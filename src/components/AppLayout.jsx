import React, { useState, useEffect } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Home, BookOpen, History, Settings, Menu, X, GraduationCap, Star } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import { useAuth } from '@/lib/AuthContext';
import UserMenuDropdown from '@/components/UserMenuDropdown';

const NAV_ITEMS = [
  { path: '/home', icon: Home, label: '홈' },
  { path: '/problems', icon: BookOpen, label: '문제' },
  { path: '/history', icon: History, label: '내 기록' },
  { path: '/bookmarks', icon: Star, label: '즐겨찾기' },
];

export default function AppLayout({ children }) {
  const location = useLocation();
  const { user } = useAuth();
  const isAdmin = user?.role === 'admin';
  const isTeacher = user?.role === 'teacher';
  const isStudent = user?.role === 'student';
  const [menuOpen, setMenuOpen] = useState(false);
  const [orgLabel, setOrgLabel] = useState('');

  useEffect(() => {
    if (!user?.academy_id && !user?.class_id) return;
    (async () => {
      try {
        const [academies, classesAll] = await Promise.all([
          user.academy_id ? base44.entities.Academy.list('name', 200) : Promise.resolve([]),
          user.class_id ? base44.entities.Class.list('name', 500) : Promise.resolve([]),
        ]);
        const academy = academies.find(a => a.id === user.academy_id);
        const cls = classesAll.find(c => c.id === user.class_id);
        const parts = [academy?.name, cls?.name].filter(Boolean);
        if (parts.length > 0) setOrgLabel(parts.join(' · '));
      } catch { /* silent */ }
    })();
  }, [user?.academy_id, user?.class_id]);

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Top bar (mobile) */}
      <header className="sticky top-0 z-40 bg-card/95 backdrop-blur-sm border-b border-border px-4 py-3 flex items-center justify-between md:hidden">
        <Link to="/home" className="flex items-center gap-2">
          <div className="w-8 h-8 bg-primary rounded-lg flex items-center justify-center">
            <span className="text-white text-sm font-bold">수</span>
          </div>
          <span className="font-bold text-foreground text-lg">수학 학습</span>
        </Link>
        <div className="flex items-center gap-2">
          <UserMenuDropdown orgLabel={orgLabel} />
          <button onClick={() => setMenuOpen(o => !o)} className="p-2 rounded-lg hover:bg-muted btn-touch">
            {menuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
        </div>
      </header>

      {/* Mobile menu overlay */}
      {menuOpen && (
        <div className="fixed inset-0 z-50 md:hidden" onClick={() => setMenuOpen(false)}>
          <div className="absolute inset-0 bg-black/40" />
          <div className="absolute top-0 right-0 w-64 h-full bg-card shadow-xl p-6 flex flex-col gap-4"
               onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <span className="font-bold text-lg">메뉴</span>
              <button onClick={() => setMenuOpen(false)} className="p-1 rounded-lg hover:bg-muted">
                <X className="w-5 h-5" />
              </button>
            </div>
            {user && (
              <div className="px-3 py-3 bg-muted rounded-xl mb-2">
                <p className="font-semibold text-sm text-foreground">{user.full_name || user.email}</p>
                <p className="text-xs text-muted-foreground mt-0.5">{user.email}</p>
              </div>
            )}
            {isStudent && NAV_ITEMS.map(item => {
              const active = location.pathname === item.path;
              return (
                <Link key={item.path} to={item.path}
                      onClick={() => setMenuOpen(false)}
                      className={`flex items-center gap-3 px-3 py-3 rounded-xl transition-colors btn-touch ${
                        active ? 'bg-primary text-primary-foreground' : 'hover:bg-muted text-foreground'
                      }`}>
                  <item.icon className="w-5 h-5" />
                  <span className="font-medium">{item.label}</span>
                </Link>
              );
            })}
            <div className="mt-auto flex flex-col gap-1">
              {isAdmin && (
                <Link to="/admin" onClick={() => setMenuOpen(false)}
                  className="flex items-center gap-3 px-3 py-3 rounded-xl transition-colors btn-touch hover:bg-muted text-muted-foreground border border-border">
                  <Settings className="w-5 h-5" />
                  <span className="font-medium text-sm">관리자 패널</span>
                </Link>
              )}
              {isTeacher && (
                <Link to="/teacher" onClick={() => setMenuOpen(false)}
                  className="flex items-center gap-3 px-3 py-3 rounded-xl transition-colors btn-touch hover:bg-muted text-muted-foreground border border-border">
                  <GraduationCap className="w-5 h-5" />
                  <span className="font-medium text-sm">강사 패널</span>
                </Link>
              )}
              <button onClick={() => base44.auth.logout('/')}
                      className="w-full px-3 py-3 rounded-xl text-left text-muted-foreground hover:bg-muted transition-colors text-sm btn-touch">
                로그아웃
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="flex flex-1">
        {/* Sidebar (desktop) */}
        <aside className="hidden md:flex w-64 flex-col border-r border-border bg-card sticky top-0 h-screen p-5 gap-2">
          {/* 상단 헤더: 로고 + 아바타 드롭다운 */}
          {/* 사이드바 상단: 앱 이름 */}
          <div className="mb-6 px-2">
            <Link to={isAdmin ? '/admin' : isTeacher ? '/teacher' : '/home'} className="flex items-center gap-3">
              <div>
                <p className="font-bold text-foreground">
                  {isAdmin ? '관리자' : (user?.full_name || '수학 학습')}
                </p>
                <p className="text-xs text-muted-foreground">
                  {isAdmin ? '관리자 패널' : isTeacher ? '강사' : (orgLabel || 'K-12 수학')}
                </p>
              </div>
            </Link>
          </div>

          <nav className="flex flex-col gap-1 flex-1">
            {isStudent && NAV_ITEMS.map(item => {
              const active = location.pathname === item.path ||
                (item.path !== '/home' && location.pathname.startsWith(item.path));
              return (
                <Link key={item.path} to={item.path}
                      className={`flex items-center gap-3 px-3 py-2.5 rounded-xl transition-colors ${
                        active ? 'bg-primary text-primary-foreground' : 'hover:bg-muted text-foreground'
                      }`}>
                  <item.icon className="w-5 h-5 flex-shrink-0" />
                  <span className="font-medium text-sm">{item.label}</span>
                </Link>
              );
            })}
          </nav>

          <div className="flex flex-col gap-1">
            {isAdmin && (
              <Link to="/admin"
                className="flex items-center gap-3 px-3 py-2.5 rounded-xl transition-colors hover:bg-muted text-muted-foreground border border-border">
                <Settings className="w-5 h-5 flex-shrink-0" />
                <span className="font-medium text-sm">관리자 패널</span>
              </Link>
            )}
            {isTeacher && (
              <Link to="/teacher"
                className="flex items-center gap-3 px-3 py-2.5 rounded-xl transition-colors hover:bg-muted text-muted-foreground border border-border">
                <GraduationCap className="w-5 h-5 flex-shrink-0" />
                <span className="font-medium text-sm">강사 패널</span>
              </Link>
            )}
          </div>
        </aside>

        {/* Main content */}
        <main className="flex-1 overflow-auto pb-20 md:pb-0">
          {/* 데스크탑 상단 바: 우측에 유저 메뉴 */}
          <div className="hidden md:flex items-center justify-end px-6 py-3 border-b border-border bg-card/50">
            <UserMenuDropdown orgLabel={orgLabel} />
          </div>
          <div className="max-w-2xl mx-auto px-4 py-6 animate-fade-in">
            {children}
          </div>
        </main>
      </div>

      {/* Bottom nav (mobile) — student only */}
      {isStudent && (
        <nav className="fixed bottom-0 left-0 right-0 z-40 md:hidden bg-card/95 backdrop-blur-sm border-t border-border safe-bottom">
          <div className="flex items-center justify-around px-2 py-2">
            {NAV_ITEMS.map(item => {
              const active = location.pathname === item.path ||
                (item.path !== '/home' && location.pathname.startsWith(item.path));
              return (
                <Link key={item.path} to={item.path}
                      className={`flex flex-col items-center gap-0.5 px-4 py-2 rounded-xl btn-touch transition-colors ${
                        active ? 'text-primary' : 'text-muted-foreground'
                      }`}>
                  <item.icon className={`w-5 h-5 ${active ? 'fill-primary/20' : ''}`} />
                  <span className="text-xs font-medium">{item.label}</span>
                </Link>
              );
            })}
          </div>
        </nav>
      )}
    </div>
  );
}