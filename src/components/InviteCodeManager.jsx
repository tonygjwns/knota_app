import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { useAuth } from '@/lib/AuthContext';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Copy, Plus, Trash2 } from 'lucide-react';
import { toast } from 'sonner';

function generateCode(length = 6) {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  return Array.from({ length }, () => chars[Math.floor(Math.random() * chars.length)]).join('');
}

const ROLE_LABELS = {
  owner: { label: '학원장', color: 'bg-amber-100 text-amber-700 border-amber-200' },
  teacher: { label: '강사', color: 'bg-blue-100 text-blue-700 border-blue-200' },
  student: { label: '학생', color: 'bg-gray-100 text-gray-600 border-gray-200' },
};

/**
 * Props:
 *  classId    - 학급 코드 발행 시
 *  academyId  - 학원 코드 발행 시 (필수)
 *  allowedRoles - 이 컴포넌트에서 발행 가능한 역할 배열
 *    예) admin: ['owner','teacher','student']
 *        owner: ['teacher','student']
 *        teacher (main): ['student']
 *        teacher (assistant): ['student']
 */
export default function InviteCodeManager({ classId, academyId, allowedRoles }) {
  const { user } = useAuth();
  const [codes, setCodes] = useState([]);
  const [loading, setLoading] = useState(true);

  // 발행 가능한 역할 결정
  const roles = allowedRoles || getDefaultRoles(user, classId);

  useEffect(() => {
    loadCodes();
  }, [classId, academyId]);

  const loadCodes = async () => {
    setLoading(true);
    try {
      const filter = classId ? { class_id: classId } : { academy_id: academyId };
      const result = await base44.entities.InviteCode.filter(filter, '-created_date', 30);
      setCodes(result);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const createCode = async (role) => {
    const isOwnerCode = role === 'owner';
    const isClassCode = !!classId && role === 'student';
    const code = generateCode(6);
    const newCode = await base44.entities.InviteCode.create({
      code,
      type: classId ? 'class' : 'academy',
      academy_id: academyId || null,
      class_id: classId || null,
      role,
      issued_by: user.id,
      is_active: true,
      one_time: isOwnerCode, // 학원장 코드는 일회용
      use_count: 0,
    });
    setCodes(prev => [newCode, ...prev]);
    toast.success(`${ROLE_LABELS[role]?.label || role} 초대코드 생성됨: ${code}`);
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
      <div className="flex items-center justify-between flex-wrap gap-2">
        <h3 className="text-sm font-semibold">초대코드 관리</h3>
        <div className="flex gap-2 flex-wrap">
          {roles.map(role => (
            <Button key={role} size="sm" variant="outline" onClick={() => createCode(role)}>
              <Plus className="w-3.5 h-3.5 mr-1" />
              {ROLE_LABELS[role]?.label || role} 코드
              {role === 'owner' && <span className="ml-1 text-xs text-amber-600">(일회용)</span>}
            </Button>
          ))}
        </div>
      </div>

      {codes.length === 0 ? (
        <p className="text-xs text-muted-foreground">아직 발행된 코드가 없어요</p>
      ) : (
        <div className="space-y-2">
          {codes.map(c => {
            const roleCfg = ROLE_LABELS[c.role] || ROLE_LABELS.student;
            return (
              <div
                key={c.id}
                className={`flex items-center justify-between p-3 rounded-xl border ${c.is_active ? 'bg-card' : 'bg-muted/40 opacity-50'}`}
              >
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-mono font-bold text-base tracking-widest">{c.code}</span>
                  <span className={`text-xs px-2 py-0.5 rounded-full border ${roleCfg.color}`}>{roleCfg.label}</span>
                  {c.one_time && <span className="text-xs px-2 py-0.5 rounded-full border bg-amber-50 text-amber-600 border-amber-200">일회용</span>}
                  {!c.is_active && <Badge variant="outline" className="text-xs">비활성</Badge>}
                </div>
                <div className="flex items-center gap-1">
                  <span className="text-xs text-muted-foreground mr-1">{c.use_count || 0}회</span>
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
            );
          })}
        </div>
      )}
    </div>
  );
}

function getDefaultRoles(user, classId) {
  if (!user) return [];
  if (user.role === 'admin') {
    return classId ? ['teacher', 'student'] : ['owner', 'teacher', 'student'];
  }
  if (user.role === 'owner') {
    return classId ? ['teacher', 'student'] : ['teacher', 'student'];
  }
  if (user.role === 'teacher') {
    return ['student'];
  }
  return [];
}