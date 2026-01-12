import * as React from 'react'
import Router from '@/router-v2/router'
import {useDarkModeState} from '@/stores/darkmode'
import ResetModal from '../login/reset/modal'
import GlobalError from './global-errors'
import OutOfDate from './out-of-date'
import RemoteProxies from '../desktop/remote/proxies.desktop'

const useDarkHookup = () => {
  const initedRef = React.useRef(false)
  const setSystemDarkMode = useDarkModeState(s => s.dispatch.setSystemDarkMode)
  React.useEffect(() => {
    const m = window.matchMedia('(prefers-color-scheme: dark)')
    if (!initedRef.current) {
      initedRef.current = true
      setSystemDarkMode(m.matches)
    }

    const handler = (e: MediaQueryListEvent) => {
      setSystemDarkMode(e.matches)
    }
    m.addEventListener('change', handler)
    return () => {
      m.removeEventListener('change', handler)
    }
  }, [setSystemDarkMode])
}

const Main = React.memo(function Main() {
  useDarkHookup()
  return (
    <>
      <RemoteProxies />
      <Router />
      <ResetModal />
      <GlobalError />
      <OutOfDate />
    </>
  )
})
// get focus so react doesn't hold onto old divs

export default Main
