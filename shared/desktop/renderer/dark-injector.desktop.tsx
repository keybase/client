import * as React from 'react'
import * as C from '@/constants'
export const DarkCSSInjector = () => {
  const isDark = C.useDarkModeState(s => s.isDarkMode())
  const [lastIsDark, setLastIsDark] = React.useState<boolean | undefined>()
  if (lastIsDark !== isDark) {
    setTimeout(() => {
      setLastIsDark(isDark)
    }, 0)
    // inject it in body so modals get darkMode also
    if (isDark) {
      document.body.classList.add('darkMode')
      document.body.classList.remove('lightMode')
    } else {
      document.body.classList.remove('darkMode')
      document.body.classList.add('lightMode')
    }
  }
  return null
}
