import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

Deno.serve(async (req) => {
  const base44 = createClientFromRequest(req);
  const user = await base44.auth.me();
  if (!user || user.role !== 'admin') {
    return Response.json({ error: 'Forbidden' }, { status: 403 });
  }

  const users = await base44.asServiceRole.entities.User.list();
  const results = [];

  // Check if any admin exists
  const existingAdmins = users.filter(u => u.role === 'admin');
  let adminSetEmail = null;

  // If no admin at all, pick one to promote
  let adminTargetId = null;
  if (existingAdmins.length === 0) {
    const preferred = users.find(u => u.email === 'mathnet.common@gmail.com');
    const target = preferred || [...users].sort((a, b) => new Date(a.created_date) - new Date(b.created_date))[0];
    if (target) {
      adminTargetId = target.id;
      adminSetEmail = target.email;
    }
  }

  for (const u of users) {
    const updates = {};
    if (!u.approval_status) {
      updates.approval_status = 'approved';
    }
    if (u.id === adminTargetId) {
      updates.role = 'admin';
    }
    if (Object.keys(updates).length > 0) {
      await base44.asServiceRole.entities.User.update(u.id, updates);
      results.push({ id: u.id, email: u.email, updates });
    } else {
      results.push({ id: u.id, email: u.email, skipped: true });
    }
  }

  const finalAdmins = users.filter(u => u.role === 'admin' || u.id === adminTargetId);

  return Response.json({
    success: true,
    total: users.length,
    admins_count: finalAdmins.length,
    admin_set: adminSetEmail,
    results,
  });
});