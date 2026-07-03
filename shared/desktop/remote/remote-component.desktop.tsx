import * as React from 'react'
import logger from '@/logger'
import {useDarkModeState} from '@/stores/darkmode'
import KB2 from '@/util/electron'

const {getRemoteProps, ipcRendererOn, showInactive} = KB2.functions

export const remoteComponentNames = ['unlock-folders', 'menubar', 'pinentry', 'tracker'] as const
export type RemoteComponentName = (typeof remoteComponentNames)[number]

type UseRemotePropsReceiverOptions = {
  component: RemoteComponentName
  param: string
  showOnProps?: boolean
}

export const getRemoteComponentParam = () => new URLSearchParams(window!.location.search).get('param') ?? ''

// darkMode rides along in the serialized props envelope; undefined until props arrive
export const useRemoteDarkModeSync = (darkMode?: boolean) => {
  const setSystemDarkMode = useDarkModeState(s => s.dispatch.setSystemDarkMode)

  React.useEffect(() => {
    if (darkMode !== undefined) {
      setSystemDarkMode(darkMode)
    }
  }, [darkMode, setSystemDarkMode])
}

export const useRemotePropsReceiver = <P,>(options: UseRemotePropsReceiverOptions) => {
  const {component, param, showOnProps = true} = options
  const [value, setValue] = React.useState<(P & {darkMode: boolean}) | null>(null)
  const hasShownWindow = React.useRef(false)

  React.useEffect(() => {
    const onProps = (raw: string) => {
      if (!raw) return
      try {
        setValue(JSON.parse(raw) as P & {darkMode: boolean})
      } catch (error) {
        logger.error('remote props parse failed', component, param, error)
      }
    }

    // subscribe before pulling so an update can't slip between the two
    const unsubscribe = ipcRendererOn?.('KBprops', (_event: unknown, raw: unknown) => {
      onProps(raw as string)
    })
    getRemoteProps?.(component, param)
      .then(onProps)
      .catch(() => {})

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
