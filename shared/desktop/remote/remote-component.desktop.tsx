import * as React from 'react'
import logger from '@/logger'
import * as R from '@/constants/remote'
import * as RemoteGen from '@/constants/remote-actions'
import {useDarkModeState} from '@/stores/darkmode'
import KB2 from '@/util/electron.desktop'

const {ipcRendererOn, showInactive} = KB2.functions

export const remoteComponentNames = ['unlock-folders', 'menubar', 'pinentry', 'tracker'] as const
export type RemoteComponentName = (typeof remoteComponentNames)[number]

type UseRemotePropsReceiverOptions = {
  component: RemoteComponentName
  param: string
  showOnProps?: boolean
}

export const getRemoteComponentParam = () => new URLSearchParams(window.location.search).get('param') ?? ''

export const useRemoteDarkModeSync = (darkMode: boolean) => {
  const setSystemDarkMode = useDarkModeState(s => s.dispatch.setSystemDarkMode)

  React.useEffect(() => {
    setSystemDarkMode(darkMode)
  }, [darkMode, setSystemDarkMode])
}

export const RemoteDarkModeSync = (p: {children: React.ReactNode; darkMode: boolean}) => {
  useRemoteDarkModeSync(p.darkMode)
  return <>{p.children}</>
}

export const useRemotePropsReceiver = <P,>(options: UseRemotePropsReceiverOptions) => {
  const {component, param, showOnProps = true} = options
  const [value, setValue] = React.useState<P | null>(null)
  const hasShownWindow = React.useRef(false)

  React.useEffect(() => {
    hasShownWindow.current = false
    setValue(null)

    const unsubscribe = ipcRendererOn?.('KBprops', (_event: unknown, raw: unknown) => {
      try {
        setValue(JSON.parse(raw as string) as P)
      } catch (error) {
        logger.error('remote props parse failed', component, param, error)
      }
    })

    R.remoteDispatch(RemoteGen.createRemoteWindowWantsProps({component, param}))

    return () => unsubscribe?.()
  }, [component, param])

  React.useEffect(() => {
    if (!value || !showOnProps || hasShownWindow.current) {
      return
    }
    hasShownWindow.current = true
    showInactive?.()
  }, [showOnProps, value])

  return value
}
