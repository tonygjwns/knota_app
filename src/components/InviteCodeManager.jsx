import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { useAuth } from '@/lib/AuthContext';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Copy, Plus, RefreshCw, Trash2 } from 'lucide-react';
import { toast } from 'sonner';

function generateCode(length = 6) {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  return Array.from({ length }, () => chars[Math.floor(Math.random() * chars.length)]).join('');
}

export default function InviteCodeManager({ classId, academyId }) {
  const { user } = useAuth();
  const [codes, setCodes] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadCodes();
  }, [classId, academyId]);

  const loadCodes = async () => {
    setLoading(true);
    try {
      const filter = classId ? { class_id: classId } : { academy_id: academyId };
      const result = await base44.entities.InviteCode.filter(filter, '-created_date', 20);
      setCodes(result);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const createCode = async (role, type) => {
    const code = generateCode(6);
    const newCode = await base44.entities.InviteCode.create({
      code,
      type,
      academy_id: academyId || (classId ? null : null),
      class_id: classId || null,
      role,
      issued_by: user.id,
      is_active: true,
      use_count: 0,
    });
    setCodes(prev => [newCode, ...prev]);
    toast.success(`코드 생성됨: ${code}`);
  };

  const deactivate = async (id) => {
    await base44.entities.InviteCode.update(id, { is_active: false });
    setCodes(prev => prev.map(c => c.id === id ? { ...c, is_active: false } : c));
    toast.success('코드가 비활성화됐어요');
  };

  const copyCode = (code) => {
    navigator.clipboard.writeText(code);
    toast.success('코드가 복사됐어요');
  };

  if (loading) return null;

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold">초대코드 관리</h3>
        <div className="flex gap-2">
          {classId && (
            <>
              <Button size="sm" variant="outline" onClick={() => createCode('student', 'class')}>
                <Plus className="w-3.5 h-3.5 mr-1" /> 학생 코드
              </Button>
              <Button size="sm" variant="outline" onClick={() => createCode('teacher', 'class')}>
                <Plus className="w-3.5 h-3.5 mr-1" /> 강사 코드
              </Button>
            </>
          )}
          {academyId && !classId && (
            <Button size="sm" variant="outline" onClick={() => createCode('teacher', 'academy')}>
              <Plus className="w-3.5 h-3.5 mr-1" /> 강사 초대코드
            </Button>
          )}
        </div>
      </div>

      {codes.length === 0 ? (
        <p className="text-xs text-muted-foreground">아직 발행된 코드가 없어요</p>
      ) : (
        <div className="space-y-2">
          {codes.map(c => (
            <div
              key={c.id}
              className={`flex items-center justify-between p-3 rounded-xl border ${c.is_active ? 'bg-card' : 'bg-muted/40 opacity-50'}`}
            >
              <div className="flex items-center gap-3">
                <span className="font-mono font-bold text-base tracking-widest">{c.code}</span>
                <Badge variant={c.role === 'student' ? 'secondary' : 'default'} className="text-xs">
                  {c.role === 'student' ? '학생' : '강사'}
                </Badge>
                {!c.is_active && <Badge variant="outline" className="text-xs">비활성</Badge>}
              </div>
              <div className="flex items-center gap-1">
                <span className="text-xs text-muted-foreground mr-2">{c.use_count || 0}회 사용</span>
                {c.is_active && (
                  <>
                    <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => copyCode(c.code)}>
                      <Copy className="w-3.5 h-3.5" />
                    </Button>
                    <Button size="icon" variant="ghost" className="h-7 w-7 text-destructive hover:text-destructive" onClick={() => deactivate(c.id)}>
                      <Trash2 className="w-3.5 h-3.5" />
                    </Button>
                  </>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}