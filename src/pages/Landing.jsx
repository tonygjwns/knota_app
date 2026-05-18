import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Eye, EyeOff, CheckCircle2, XCircle } from 'lucide-react';

const FEATURES = [
  { emoji: '✍️', title: '손으로 풀기', desc: '필기 또는 사진 업로드로 풀이를 제출해 보세요' },
  { emoji: '🤖', title: 'AI 단계별 피드백', desc: '어디가 맞고 어디서 막혔는지 단계별로 알려드려요' },
  { emoji: '📊', title: '내 풀이 기록', desc: '단원별·도구별 약점을 추적하고 다시 풀어볼 수 있어요' },
];

export default function Landing() {
  const navigate = useNavigate();
  const [mode, setMode] = useState('home'); // 'home' | 'signup'

  // signup form state
  const [role, setRole] = useState('student');
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPw, setShowPw] = useState(false);
  const [showConfirmPw, setShowConfirmPw] = useState(false);
  const [inviteCode, setInviteCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    base44.auth.isAuthenticated().then(authed => {
      if (authed) navigate('/home', { replace: true });
    });
  }, [navigate]);

  const passwordMatch = confirmPassword.length > 0 && password === confirmPassword;
  const passwordMismatch = confirmPassword.length > 0 && password !== confirmPassword;

  const handleSignup = async (e) => {
    e.preventDefault();
    if (password !== confirmPassword) { setError('비밀번호가 일치하지 않아요.'); return; }
    if (password.length < 6) { setError('비밀번호는 6자 이상이어야 해요.'); return; }
    setLoading(true);
    setError('');

    // Step 1: Register
    try {
      await base44.auth.register({ email, password });
    } catch (registerErr) {
      console.error('[회원가입] register 오류:', registerErr);
      const msg = registerErr?.response?.data?.detail || registerErr?.message || '';
      if (msg.toLowerCase().includes('already') || msg.toLowerCase().includes('exist') || msg.toLowerCase().includes('duplicate')) {
        setError('이미 사용 중인 이메일이에요. 로그인을 시도해 보세요.');
      } else if (msg.toLowerCase().includes('invalid') || msg.toLowerCase().includes('password')) {
        setError('이메일 또는 비밀번호 형식이 올바르지 않아요. 비밀번호는 6자 이상이어야 해요.');
      } else {
        setError(msg || '회원가입에 실패했어요. 다시 시도해 주세요.');
      }
      setLoading(false);
      return;
    }

    // Build user data
    const userData = { full_name: fullName, role, approval_status: 'pending' };

    // Process invite code if provided
    if (inviteCode.trim()) {
      const code = inviteCode.trim().toUpperCase();
      try {
        const codes = await base44.entities.InviteCode.filter(
          { code, is_active: true }, '-created_date', 1
        );
        if (codes.length === 0) {
          setError('유효하지 않은 코드예요. 코드를 확인해 주세요.');
          setLoading(false);
          return;
        }
        const c = codes[0];
        // role 일치 검증
        if (c.role !== role) {
          const roleLabel = { owner: '학원장', teacher: '강사', student: '학생' };
          setError(`선택한 역할(${roleLabel[role]})과 코드의 역할(${roleLabel[c.role]})이 달라요`);
          setLoading(false);
          return;
        }
        userData.academy_id = c.academy_id;
        if (c.class_id) userData.class_id = c.class_id;
        if (c.role === 'teacher' && c.class_id) {
          userData.class_ids = [c.class_id];
        }
        if (c.role === 'owner' || c.role === 'teacher') {
          userData.approval_status = 'approved';
        }
        if (c.one_time) {
          await base44.entities.InviteCode.delete(c.id);
        } else {
          await base44.entities.InviteCode.update(c.id, { use_count: (c.use_count || 0) + 1 });
        }
      } catch (codeErr) {
        console.error('[회원가입] 코드 처리 오류:', codeErr);
        setError('코드 처리 중 오류가 발생했어요. 다시 시도해 주세요');
        setLoading(false);
        return;
      }
    } else {
      // 코드 없이 가입 — student만 허용
      if (role === 'owner' || role === 'teacher') {
        setError(`${role === 'owner' ? '학원장' : '강사'}으로 가입하려면 초대코드가 필요해요`);
        setLoading(false);
        return;
      }
    }

    // Step 2: register 후 이미 세션이 생성되므로 바로 프로필 업데이트
    try {
      await base44.auth.updateMe(userData);
    } catch (updateErr) {
      console.error('[회원가입] 프로필 업데이트 오류:', updateErr);
      // 프로필 업데이트 실패해도 계속 진행
    }
    setLoading(false);
    navigate('/home', { replace: true });
  };

  if (mode === 'signup') {
    return (
      <div className="min-h-screen bg-background flex flex-col items-center justify-center px-4 font-korean">
        <div className="w-full max-w-md">
          {/* Logo */}
          <div className="flex items-center gap-2 mb-8">
            <div className="w-9 h-9 bg-primary rounded-xl flex items-center justify-center shadow-sm">
              <span className="text-white font-bold text-base">수</span>
            </div>
            <span className="font-bold text-foreground text-lg">KNOTA</span>
          </div>

          <form onSubmit={handleSignup} className="space-y-4">
            <div>
              <h2 className="text-2xl font-bold">회원가입</h2>
              <p className="text-muted-foreground text-sm mt-1">아래 정보를 입력해 주세요</p>
            </div>

            {/* Name */}
            <div>
              <label className="text-sm font-medium block mb-1">이름</label>
              <Input
                placeholder="홍길동"
                value={fullName}
                onChange={e => setFullName(e.target.value)}
                required
              />
            </div>

            {/* Email */}
            <div>
              <label className="text-sm font-medium block mb-1">이메일</label>
              <Input
                type="email"
                placeholder="example@email.com"
                value={email}
                onChange={e => setEmail(e.target.value)}
                required
              />
            </div>

            {/* Password */}
            <div>
              <label className="text-sm font-medium block mb-1">비밀번호</label>
              <div className="relative">
                <Input
                  type={showPw ? 'text' : 'password'}
                  placeholder="6자 이상"
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  required
                  className="pr-10"
                />
                <button
                  type="button"
                  onClick={() => setShowPw(v => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                >
                  {showPw ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            {/* Confirm password */}
            <div>
              <label className="text-sm font-medium block mb-1">비밀번호 확인</label>
              <div className="relative">
                <Input
                  type={showConfirmPw ? 'text' : 'password'}
                  placeholder="비밀번호를 다시 입력해 주세요"
                  value={confirmPassword}
                  onChange={e => setConfirmPassword(e.target.value)}
                  required
                  className={`pr-10 ${passwordMismatch ? 'border-red-400 focus-visible:ring-red-400' : passwordMatch ? 'border-emerald-400 focus-visible:ring-emerald-400' : ''}`}
                />
                <button
                  type="button"
                  onClick={() => setShowConfirmPw(v => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                >
                  {showConfirmPw ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
              {passwordMatch && (
                <p className="flex items-center gap-1 text-xs text-emerald-600 mt-1">
                  <CheckCircle2 className="w-3.5 h-3.5" /> 비밀번호가 일치해요
                </p>
              )}
              {passwordMismatch && (
                <p className="flex items-center gap-1 text-xs text-red-500 mt-1">
                  <XCircle className="w-3.5 h-3.5" /> 비밀번호가 일치하지 않아요
                </p>
              )}
            </div>

            {/* Divider */}
            <div className="border-t border-border pt-2">
              {/* Role selection */}
              <div className="mb-3">
                <label className="text-sm font-medium block mb-2">가입 유형</label>
                <div className="grid grid-cols-3 gap-2">
                  {[{ value: 'owner', label: '🏫 학원장' }, { value: 'teacher', label: '👩‍🏫 강사' }, { value: 'student', label: '🎒 학생' }].map(r => (
                    <button
                      key={r.value}
                      type="button"
                      onClick={() => setRole(r.value)}
                      className={`py-2.5 rounded-xl border text-sm font-medium transition-colors ${
                        role === r.value
                          ? 'bg-primary text-primary-foreground border-primary'
                          : 'bg-background border-input text-foreground hover:bg-muted'
                      }`}
                    >
                      {r.label}
                    </button>
                  ))}
                </div>
                {(role === 'owner' || role === 'teacher') && (
                  <p className="text-xs text-amber-600 mt-1">초대코드가 필요해요</p>
                )}
              </div>

              {/* Invite code */}
              <div>
                <label className="text-sm font-medium block mb-1">초대코드</label>
                <Input
                  placeholder="학원코드 또는 학급코드 입력 (선택)"
                  value={inviteCode}
                  onChange={e => setInviteCode(e.target.value.toUpperCase())}
                  className="tracking-widest font-mono"
                  maxLength={8}
                />
                <p className="text-xs text-muted-foreground mt-1">코드 입력 시 해당 학급/학원에 자동으로 소속돼요</p>
              </div>
            </div>

            {error && <p className="text-sm text-red-500 bg-red-50 rounded-lg px-3 py-2">{error}</p>}

            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? '가입 중...' : '회원가입'}
            </Button>

            <p className="text-center text-sm text-muted-foreground">
              이미 계정이 있으신가요?{' '}
              <button type="button" onClick={() => base44.auth.redirectToLogin('/home')} className="text-primary hover:underline font-medium">
                로그인
              </button>
            </p>
            <button type="button" onClick={() => setMode('home')} className="w-full text-center text-xs text-muted-foreground hover:text-foreground transition-colors">
              ← 처음으로
            </button>
          </form>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background flex flex-col font-korean">
      <header className="sticky top-0 z-40 bg-card/95 backdrop-blur-sm border-b border-border px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-9 h-9 bg-primary rounded-xl flex items-center justify-center shadow-sm">
            <span className="text-white font-bold text-base">수</span>
          </div>
          <span className="font-bold text-foreground text-lg">KNOTA</span>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => setMode('signup')}>회원가입</Button>
          <Button size="sm" onClick={() => base44.auth.redirectToLogin('/home')}>로그인</Button>
        </div>
      </header>

      <section className="flex-1 flex flex-col items-center justify-center text-center px-6 py-16 gap-6">
        <div className="w-20 h-20 bg-primary/10 rounded-3xl flex items-center justify-center mb-2">
          <span className="text-5xl">🧮</span>
        </div>
        <h1 className="text-3xl md:text-4xl font-bold text-foreground leading-tight">
          수학을 손으로 풀고,<br />
          <span className="text-primary">AI가 채점해 드려요</span>
        </h1>
        <p className="text-muted-foreground text-base md:text-lg max-w-md leading-relaxed">
          K-12 수학 문제를 필기로 풀고 AI에게 단계별 피드백을 받아보세요.
          틀린 곳, 빠진 곳, 오류 유형까지 정확하게 알려드려요.
        </p>
        <div className="flex gap-3 mt-2 flex-wrap justify-center">
          <Button size="lg" className="px-10 py-6 text-lg rounded-2xl shadow-lg" onClick={() => setMode('signup')}>
            회원가입 →
          </Button>
          <Button size="lg" variant="outline" className="px-8 py-6 text-lg rounded-2xl" onClick={() => base44.auth.redirectToLogin('/home')}>
            로그인
          </Button>
        </div>
      </section>

      <section className="px-6 pb-16 max-w-3xl mx-auto w-full">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {FEATURES.map((f) => (
            <div key={f.title} className="bg-card border border-border rounded-2xl p-6 flex flex-col gap-3 shadow-sm hover:shadow-md transition-shadow">
              <span className="text-3xl">{f.emoji}</span>
              <h3 className="font-bold text-foreground text-base">{f.title}</h3>
              <p className="text-muted-foreground text-sm leading-relaxed">{f.desc}</p>
            </div>
          ))}
        </div>
      </section>

      <footer className="border-t border-border py-6 text-center text-muted-foreground text-sm">
        © 2026 KNOTA
      </footer>
    </div>
  );
}