import * as React from 'react'
import * as RemoteGen from '../actions/remote-gen'
import * as R from '@/constants/remote'
import Pinentry from './index.desktop'
import type {DeserializeProps} from './remote-serializer.desktop'
import {useDarkModeState} from '@/stores/darkmode'

const RemoteContainer = (d: DeserializeProps) => {
  const {darkMode, ...rest} = d
  const setSystemDarkMode = useDarkModeState(s => s.dispatch.setSystemDarkMode)

  React.useEffect(() => {
    const id = setTimeout(() => {
      setSystemDarkMode(darkMode)
    }, 1)
    return () => {
      clearTimeout(id)
    }
  }, [setSystemDarkMode, darkMode])

  return (
    <Pinentry
      {...rest}
      onCancel={() => R.remoteDispatch(RemoteGen.createPinentryOnCancel())}
      onSubmit={(password: string) => R.remoteDispatch(RemoteGen.createPinentryOnSubmit({password}))}
    />
  )
}
export default RemoteContainer
