export type UserIdentity = {
  email?: string | null;
  nombre?: string | null;
};

export function userIdentityLabel(
  user: UserIdentity | null | undefined,
  fallback = "Usuario"
) {
  const email = user?.email?.trim().toLowerCase();
  const nombre = user?.nombre?.trim();

  if (email && nombre) return `${email} - ${nombre}`;
  return email || nombre || fallback;
}

export function relatedUserIdentity<T extends UserIdentity>(
  value: T | T[] | null | undefined,
  fallback = "Usuario"
) {
  return userIdentityLabel(Array.isArray(value) ? value[0] : value, fallback);
}
