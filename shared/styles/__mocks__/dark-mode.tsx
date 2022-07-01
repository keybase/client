let systemDarkMode = false
export const _setDarkModePreference = () => {}
// ONLY from system hooks, never call this directly
export const _setSystemIsDarkMode = (dm: boolean) => {
  systemDarkMode = dm
}
export const isDarkMode = () => {
  return systemDarkMode
}
