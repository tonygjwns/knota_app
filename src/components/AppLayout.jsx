import React, { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Home, BookOpen, History, Settings, Menu, X } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import { useAuth } from '@/lib/AuthContext';

const NAV_ITEMS = [
  { path: '/home', icon: Home, label: '홈' },
  { path: '/problems', icon: BookOpen, label: '문제' },
  { path: '/history', icon: History, label: '내 기록' },
];

export default function AppLayout({ children }) {
  const location = useLocation();
  const { user } = useAuth();
  const isAdmin = user?.role === 'admin';
  const [menuOpen, setMenuOpen] = useState(false);

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
          {user && (
            <span className="text-xs text-muted-foreground font-medium truncate max-w-[80px]">
              {user.full_name || user.email?.split('@')[0]}
            </span>
          )}
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
            {NAV_ITEMS.map(item => {
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
                <Link
                  to="/admin"
                  onClick={() => setMenuOpen(false)}
                  className="flex items-center gap-3 px-3 py-3 rounded-xl transition-colors btn-touch hover:bg-muted text-muted-foreground border border-border">
                  <Settings className="w-5 h-5" />
                  <span className="font-medium text-sm">관리자 패널</span>
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
          <Link to="/home" className="flex items-center gap-3 mb-6 px-2">
            <div className="w-10 h-10 bg-primary rounded-xl flex items-center justify-center">
              <span className="text-white font-bold text-lg">수</span>
            </div>
            <div>
              <p className="font-bold text-foreground">수학 학습</p>
              <p className="text-xs text-muted-foreground">K-12 수학</p>
            </div>
          </Link>

          {user && (
            <div className="px-3 py-3 bg-muted rounded-xl mb-3">
              <p className="font-semibold text-sm text-foreground">{user.full_name || '학생'}</p>
              <p className="text-xs text-muted-foreground mt-0.5">{user.email}</p>
            </div>
          )}

          <nav className="flex flex-col gap-1 flex-1">
            {NAV_ITEMS.map(item => {
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
              <Link
                to="/admin"
                className="flex items-center gap-3 px-3 py-2.5 rounded-xl transition-colors hover:bg-muted text-muted-foreground border border-border">
                <Settings className="w-5 h-5 flex-shrink-0" />
                <span className="font-medium text-sm">관리자 패널</span>
              </Link>
            )}
            <button onClick={() => base44.auth.logout('/')}
                    className="flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-muted text-muted-foreground transition-colors text-sm">
              로그아웃
            </button>
          </div>
        </aside>

        {/* Main content */}
        <main className="flex-1 overflow-auto pb-20 md:pb-0">
          <div className="max-w-2xl mx-auto px-4 py-6 animate-fade-in">
            {children}
          </div>
        </main>
      </div>

      {/* Bottom nav (mobile) — NAV_ITEMS only */}
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
    </div>
  );
}