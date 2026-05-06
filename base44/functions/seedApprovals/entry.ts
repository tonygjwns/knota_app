import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

Deno.serve(async (req) => {
  const base44 = createClientFromRequest(req);
  const user = await base44.auth.me();
  if (!user || user.role !== 'admin') {
    return Response.json({ error: 'Forbidden' }, { status: 403 });
  }

  const users = await base44.asServiceRole.entities.User.list();
  const results = [];

  for (const u of users) {
    const updates = {};
    if (!u.approval_status) {
      updates.approval_status = 'approved';
    }
    if (Object.keys(updates).length > 0) {
      await base44.asServiceRole.entities.User.update(u.id, updates);
      results.push({ id: u.id, email: u.email, updates });
    } else {
      results.push({ id: u.id, email: u.email, skipped: true });
    }
  }

  return Response.json({ success: true, total: users.length, results });
});