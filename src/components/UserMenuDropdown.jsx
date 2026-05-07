import React, { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { base44 } from '@/api/base44Client';
import { useAuth } from '@/lib/AuthContext';
import { Settings, LogOut, ChevronDown } from 'lucide-react';

const ROLE_LABELS = { admin: '관리자', teacher: '강사', student: '학생' };

export default function UserMenuDropdown({ orgLabel }) {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    const handler = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const close = () => setOpen(false);

  const initials = user?.full_name
    ? user.full_name.slice(0, 1)
    : user?.email?.slice(0, 1)?.toUpperCase() || '?';

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen(o => !o)}
        className="flex items-center gap-2 px-2 py-1.5 rounded-xl hover:bg-muted transition-colors"
      >
        <div className="w-8 h-8 rounded-full bg-primary flex items-center justify-center text-white text-sm font-bold flex-shrink-0">
          {initials}
        </div>
        <ChevronDown className={`w-3.5 h-3.5 text-muted-foreground transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>

      {open && (
        <div className="absolute right-0 top-full mt-1.5 w-64 bg-card rounded-xl shadow-lg border border-border z-50 overflow-hidden">
          {/* 사용자 정보 헤더 */}
          <button
            className="w-full flex items-center gap-3 p-4 hover:bg-muted transition-colors text-left"
            onClick={() => { navigate('/profile'); close(); }}
          >
            <div className="w-10 h-10 rounded-full bg-primary flex items-center justify-center text-white font-bold flex-shrink-0">
              {initials}
            </div>
            <div className="min-w-0 flex-1">
              <p className="font-semibold text-sm text-foreground truncate">{user?.full_name || '이름 없음'}</p>
              <p className="text-xs text-muted-foreground truncate">{user?.email}</p>
              <span className="inline-block mt-0.5 text-xs bg-primary/10 text-primary px-2 py-0.5 rounded-full">
                {ROLE_LABELS[user?.role] || user?.role}
              </span>
            </div>
          </button>

          {/* 학원/학급 */}
          {orgLabel && (
            <div className="px-4 pb-2">
              <p className="text-xs text-muted-foreground">{orgLabel}</p>
            </div>
          )}

          <div className="border-t border-border" />

          {/* 메뉴 아이템 */}
          <div className="p-1">
            <button
              className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg hover:bg-muted transition-colors text-left text-sm text-foreground"
              onClick={() => { navigate('/profile'); close(); }}
            >
              <Settings className="w-4 h-4 text-muted-foreground" />
              내 정보 관리
            </button>
            <button
              className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg hover:bg-destructive/10 transition-colors text-left text-sm text-destructive"
              onClick={() => { base44.auth.logout('/'); close(); }}
            >
              <LogOut className="w-4 h-4" />
              로그아웃
            </button>
          </div>
        </div>
      )}
    </div>
  );
}