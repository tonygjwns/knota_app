import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const caller = await base44.auth.me();
    if (!caller) return Response.json({ authorized: false, reason: 'unauthenticated' }, { status: 401 });

    const { attemptId } = await req.json();
    if (!attemptId) return Response.json({ authorized: false, reason: 'attemptId required' }, { status: 400 });

    const attempts = await base44.asServiceRole.entities.StudentAttempt.filter({ id: attemptId }, '-created_date', 1);
    if (attempts.length === 0) return Response.json({ authorized: false, reason: 'attempt not found' }, { status: 404 });
    const a = attempts[0];

    // 본인
    if (a.student_id === caller.id) return Response.json({ authorized: true });

    // admin
    if (caller.role === 'admin') return Response.json({ authorized: true });

    // owner: 같은 학원 학생
    if (caller.role === 'owner') {
      const users = await base44.asServiceRole.entities.User.filter({ id: a.student_id }, '-created_date', 1);
      const student = users[0];
      if (student?.academy_id === caller.academy_id) return Response.json({ authorized: true });
      return Response.json({ authorized: false, reason: 'different academy' });
    }

    // teacher: main + assistant 담당 학급 학생
    if (caller.role === 'teacher') {
      const classes = await base44.asServiceRole.entities.Class.list('name', 500);
      const myClassIds = new Set(
        classes.filter(c =>
          c.main_teacher_id === caller.id ||
          (c.assistant_teacher_ids || []).includes(caller.id)
        ).map(c => c.id)
      );
      if (myClassIds.size === 0) return Response.json({ authorized: false, reason: 'no classes' });

      const users = await base44.asServiceRole.entities.User.filter({ id: a.student_id }, '-created_date', 1);
      const student = users[0];
      if (student && myClassIds.has(student.class_id)) return Response.json({ authorized: true });
      return Response.json({ authorized: false, reason: 'student not in my classes' });
    }

    return Response.json({ authorized: false, reason: 'unknown role' });
  } catch (e) {
    return Response.json({ authorized: false, reason: e.message }, { status: 500 });
  }
});