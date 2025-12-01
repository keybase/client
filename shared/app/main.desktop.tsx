import * as React from 'react'
import Router from '@/router-v2/router'
import {useState_ as useDarkModeState} from '@/constants/darkmode'
import ResetModal from '../login/reset/modal'
import GlobalError from './global-errors'
import OutOfDate from './out-of-date'
import RemoteProxies from '../desktop/remote/proxies.desktop'
import {debugUnClear, debugClear, ENABLE_F5_REMOUNTS} from '@/util/debug'

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
  const [show, setShow] = React.useState(true)
  useDarkHookup()
  const toggle = React.useCallback((e: KeyboardEvent) => {
    if (e.key === 'F5') {
      setShow(s => !s)
    }
  }, [])
  React.useEffect(() => {
    if (!ENABLE_F5_REMOUNTS) return

    const body = document.body
    body.addEventListener('keydown', toggle)
    return () => {
      body.removeEventListener('keydown', toggle)
    }
  }, [toggle])
  React.useEffect(() => {
    if (!ENABLE_F5_REMOUNTS) return
    if (show) {
      debugUnClear()
    } else {
      debugClear()
    }
  }, [show])

  return show ? (
    <>
      <RemoteProxies />
      <Router />
      <ResetModal />
      <GlobalError />
      {ENABLE_F5_REMOUNTS ? null : <OutOfDate />}
    </>
  ) : (
    <div>
      debug hide react
      <input autoFocus={true} />
    </div>
  )
})
// get focus so react doesn't hold onto old divs

export default Main
