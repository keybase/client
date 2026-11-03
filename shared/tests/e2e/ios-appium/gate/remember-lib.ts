// Putting the second account's "Always stay logged in" back on, with its stored secret in place: what
// the remember-password flow's before() runs (a failed restore of an earlier run may have left it
// off) and its afterEach runs. The service reads and sets the setting for the account signed in, so
// the app is on the second account before it is read; a missing stored secret is put back first with
// the password (the second account cannot be reached without it). Framework-free, so jest tests it.

export type RememberSides = {
  // the phone keeps a stored secret for the second account
  storedSecret: () => Promise<boolean>
  // signs the second account in with its password from the login screen (the marked path)
  signInWithPassword: () => Promise<void>
  // puts the app on the second account (from its stored secret) and checks it is there
  toSecond: () => Promise<void>
  remember: () => Promise<boolean>
  setRememberOn: () => Promise<void>
}

// Returns whether the setting was off and was put back on.
export const repairRememberLeftOff = async (s: RememberSides): Promise<boolean> => {
  if (!(await s.storedSecret())) await s.signInWithPassword()
  await s.toSecond()
  if (await s.remember()) return false
  await s.setRememberOn()
  if (!(await s.remember())) throw new Error('the second account remember-password setting did not go back on')
  if (!(await s.storedSecret())) throw new Error('the phone keeps no stored secret for the second account after the setting went back on')
  return true
}
