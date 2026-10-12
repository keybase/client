import * as React from 'react'
import {useDarkModeState} from '@/stores/darkmode'
import KB2, {type RemoteProps} from '@/util/electron'

const {getRemoteProps, ipcRendererOn, showInactive} = KB2.functions

export const remoteComponentNames = ['unlock-folders', 'menubar', 'pinentry', 'tracker'] as const
export type RemoteComponentName = (typeof remoteComponentNames)[number]

type UseRemotePropsReceiverOptions = {
  component: RemoteComponentName
  param: string
  showOnProps?: boolean
}

export const getRemoteComponentParam = () => new URLSearchParams(window!.location.search).get('param') ?? ''

// darkMode rides along in the props; undefined until props arrive
export const useRemoteDarkModeSync = (darkMode?: boolean) => {
  const setSystemDarkMode = useDarkModeState(s => s.dispatch.setSystemDarkMode)

  React.useEffect(() => {
    if (darkMode !== undefined) {
      setSystemDarkMode(darkMode)
      // hidden/transparent remote windows don't reliably get prefers-color-scheme
      // media query updates, so drive the CSS light-dark() resolution explicitly
      document.documentElement.style.colorScheme = darkMode ? 'dark' : 'light'
    }
  }, [darkMode, setSystemDarkMode])
}

export const useRemotePropsReceiver = <P,>(options: UseRemotePropsReceiverOptions) => {
  const {component, param, showOnProps = true} = options
  const [value, setValue] = React.useState<(P & {darkMode: boolean}) | null>(null)
  const hasShownWindow = React.useRef(false)

  React.useEffect(() => {
    let lastVersion = 0
    const onProps = (remoteProps: RemoteProps | undefined) => {
      if (!remoteProps || remoteProps.version <= lastVersion) return
      lastVersion = remoteProps.version
      setValue(remoteProps.props as P & {darkMode: boolean})
    }

    // subscribe before pulling so an update can't slip between the two
    const unsubscribe = ipcRendererOn?.('KBprops', (remoteProps: unknown) => {
      onProps(remoteProps as RemoteProps)
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
