export function getSafeRedirectPath(value: string | null | undefined, fallback = "/dashboard") {
  if (!value) {
    return fallback;
  }

  const nextPath = value.trim();
  if (!nextPath.startsWith("/") || nextPath.startsWith("//")) {
    return fallback;
  }

  return nextPath;
}
