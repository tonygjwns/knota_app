/**
 * Role-aware redirect target.
 * Use instead of hardcoding '/home' for navigate() on protected pages.
 */
export function redirectByRole(user) {
  if (user?.role === 'admin') return '/admin';
  if (user?.role === 'owner') return '/teacher';
  if (user?.role === 'teacher') return '/teacher';
  return '/home';
}