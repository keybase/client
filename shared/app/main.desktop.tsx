import * as React from 'react'
import Router from '@/router-v2/router'
import ResetModal from '../login/reset/modal'
import GlobalError from './global-errors'
import OutOfDate from './out-of-date'
import Flags from '@/util/feature-flags'

type Props = {}

const Main = (_: Props) => {
  const [show, setShow] = React.useState(true)
  const toggle = React.useCallback((e: KeyboardEvent) => {
    if (e.key === 'F5') {
      setShow(s => !s)
    }
  }, [])
  React.useEffect(() => {
    if (!Flags.admin) return

    const body = document.body
    body.addEventListener('keydown', toggle)
    return () => {
      body.removeEventListener('keydown', toggle)
    }
  }, [toggle])
  return show ? (
    <>
      <Router />
      <ResetModal />
      <GlobalError />
      <OutOfDate />
    </>
  ) : null
}

export default Main
