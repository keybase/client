import * as React from 'react'
import Router from '@/router-v2/router'
import ResetModal from '../login/reset/modal'
import GlobalError from './global-errors'
import OutOfDate from './out-of-date'
import RemoteProxies from '../desktop/remote/proxies.desktop'
import {debugUnClear, debugClear, ENABLE_F5_REMOUNTS} from '@/util/debug'

const Main = React.memo(function Main() {
  const [show, setShow] = React.useState(true)
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
