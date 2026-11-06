// Public encoding validation only. No private key or key generation.
export function vapidPublicKeyError(value) {
  if (value == null || value === "") return null;
  try {
    if (
      typeof value !== "string" ||
      !/^B[A-Za-z0-9_-]{85,87}={0,2}$/.test(value)
    )
      throw Error();
    const bytes = Uint8Array.from(
      atob(value.replace(/-/g, "+").replace(/_/g, "/")),
      (c) => c.charCodeAt(0),
    );
    if (bytes.length !== 65 || bytes[0] !== 4) throw Error();
    return null;
  } catch {
    return "La clave VAPID pública debe tener formato P-256 sin comprimir. Nunca uses la clave privada.";
  }
}
