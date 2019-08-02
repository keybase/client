import flags from '../util/feature-flags'

let _isDarkMode = false
export const setIsDarkMode = (dm: boolean) => {
  _isDarkMode = dm
}
export const isDarkMode = () => flags.darkMode && _isDarkMode
