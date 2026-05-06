import React from 'react';
import { Clock, XCircle, LogOut } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { base44 } from '@/api/base44Client';

export default function PendingApprovalScreen({ user }) {
  const isRejected = user?.approval_status === 'rejected';

  return (
    <div className="fixed inset-0 bg-background flex items-center justify-center p-4">
      <div className="bg-card rounded-2xl shadow-xl p-8 max-w-sm w-full flex flex-col items-center gap-5 text-center">
        <div className={`w-16 h-16 rounded-full flex items-center justify-center ${
          isRejected ? 'bg-red-100' : 'bg-amber-100'
        }`}>
          {isRejected
            ? <XCircle className="w-8 h-8 text-red-500" />
            : <Clock className="w-8 h-8 text-amber-500" />
          }
        </div>

        <div>
          <h1 className="text-xl font-bold text-foreground">
            {isRejected ? '승인이 거절됐어요' : '관리자 승인 대기 중'}
          </h1>
          <p className="text-sm text-muted-foreground mt-2 leading-relaxed">
            {isRejected
              ? `승인이 거절됐어요. 사유: ${user?.rejected_reason || '(사유 없음)'}\n관리자에게 문의해 주세요.`
              : '회원가입 신청이 접수됐어요. 관리자가 승인하면 이용하실 수 있어요. 보통 1영업일 안에 처리돼요.'
            }
          </p>
        </div>

        {user && (
          <div className="w-full bg-muted rounded-xl px-4 py-3 text-left space-y-1">
            <p className="text-xs text-muted-foreground">이름</p>
            <p className="text-sm font-medium">{user.full_name || '(이름 없음)'}</p>
            <p className="text-xs text-muted-foreground mt-2">이메일</p>
            <p className="text-sm font-medium">{user.email}</p>
            <p className="text-xs text-muted-foreground mt-2">가입 일시</p>
            <p className="text-sm font-medium">
              {user.created_date
                ? new Date(user.created_date).toLocaleString('ko-KR')
                : '-'}
            </p>
          </div>
        )}

        <Button
          variant="outline"
          className="w-full gap-2"
          onClick={() => base44.auth.logout('/')}
        >
          <LogOut className="w-4 h-4" />
          로그아웃
        </Button>
      </div>
    </div>
  );
}