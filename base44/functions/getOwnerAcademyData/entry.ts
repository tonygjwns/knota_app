import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const caller = await base44.auth.me();
    if (!caller) return Response.json({ error: 'unauthenticated' }, { status: 401 });

    // 학원 찾기 (user.academy_id 우선 + owner_id fallback)
    let academy = null;
    if (caller.academy_id) {
      const [a] = await base44.asServiceRole.entities.Academy.filter({ id: caller.academy_id });
      academy = a || null;
    }
    if (!academy) {
      const owned = await base44.asServiceRole.entities.Academy.filter({ owner_id: caller.id }, '-created_date', 1);
      academy = owned[0] || null;
    }
    if (!academy) return Response.json({ academy: null, classes: [], teachers: [] });

    // 권한 체크
    const isAuthorized = caller.role === 'admin' || caller.role === 'owner' || academy.owner_id === caller.id;
    if (!isAuthorized) return Response.json({ error: 'forbidden' }, { status: 403 });

    const [classes, users, inviteCodes] = await Promise.all([
      base44.asServiceRole.entities.Class.filter({ academy_id: academy.id }, 'name', 200),
      base44.asServiceRole.entities.User.filter({ academy_id: academy.id }, '-created_date', 500),
      base44.asServiceRole.entities.InviteCode.filter({ academy_id: academy.id }, '-created_date', 200),
    ]);
    const teachers = users.filter(u => u.role === 'teacher');

    return Response.json({ academy, classes, teachers, invite_codes: inviteCodes });
  } catch (e) {
    return Response.json({ error: e.message }, { status: 500 });
  }
});