// Darkmode is managed by redux but for things (proxies and etc) to get this value simply the value is
// copied here
export type DarkModePreference = 'system' | 'alwaysDark' | 'alwaysLight' | undefined

let darkModePreference: DarkModePreference
let systemDarkMode = false
// supports system level changes
let systemSupported = false

// called ONLY from config sagas / mobile boot / remote windows
export const _setDarkModePreference = (pref: DarkModePreference) => {
  darkModePreference = pref
}
// ONLY from system hooks, never call this directly
export const _setSystemIsDarkMode = (dm: boolean) => {
  systemDarkMode = dm
}
export const _setSystemSupported = (supported: boolean) => {
  systemSupported = supported
}

export const isDarkMode = () => {
  switch (darkModePreference) {
    case undefined:
      return systemDarkMode
    case 'system':
      return systemDarkMode
    case 'alwaysDark':
      return true
    case 'alwaysLight':
      return false
  }
}

export const isDarkModeSystemSupported = () => systemSupported
export const isSystemDarkMode = () => systemDarkMode
