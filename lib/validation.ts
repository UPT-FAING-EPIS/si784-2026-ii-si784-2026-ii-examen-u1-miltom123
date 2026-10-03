/**
 * Sistema de Apuestas a Eventos Deportivos en Línea
 * Autor: Milton H Flores Chino
 * Validaciones de Datos para Frontend y Backend
 */

export interface ValidationResult {
  valid: boolean;
  errors: Record<string, string>;
}

export function validateRegister(data: {
  name?: string;
  email?: string;
  password?: string;
  role?: string;
}): ValidationResult {
  const errors: Record<string, string> = {};

  if (
    typeof data.name !== "string" ||
    data.name.trim().length < 3 ||
    data.name.length > 120
  ) {
    errors.name = "El nombre completo debe tener al menos 3 caracteres.";
  }

  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (
    typeof data.email !== "string" ||
    data.email.length > 150 ||
    !emailRegex.test(data.email.trim())
  ) {
    errors.email = "Debe proporcionar un correo electrónico válido.";
  }

  if (
    typeof data.password !== "string" ||
    data.password.length < 10 ||
    Buffer.byteLength(data.password, "utf8") > 72
  ) {
    errors.password =
      "La contraseña debe tener entre 10 caracteres y 72 bytes.";
  }

  if (data.role && !["admin", "bettor"].includes(data.role)) {
    errors.role = 'El rol debe ser "admin" o "bettor".';
  }

  return {
    valid: Object.keys(errors).length === 0,
    errors,
  };
}

export function validateLogin(data: {
  email?: string;
  password?: string;
}): ValidationResult {
  const errors: Record<string, string> = {};

  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (
    typeof data.email !== "string" ||
    data.email.length > 150 ||
    !emailRegex.test(data.email.trim())
  ) {
    errors.email = "Debe proporcionar un correo electrónico válido.";
  }

  if (
    typeof data.password !== "string" ||
    data.password.length === 0 ||
    data.password.length > 100
  ) {
    errors.password = "La contraseña es obligatoria.";
  }

  return {
    valid: Object.keys(errors).length === 0,
    errors,
  };
}
