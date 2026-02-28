/**
 * Returns true if the string is a valid email address, false otherwise.
 */
export function validateEmailAddress(str: string): boolean {
  const emailRegex = /^(\S+@\S+\.\S+)$/
  return str.length > 3 && emailRegex.test(str)
}
