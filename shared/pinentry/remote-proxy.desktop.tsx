// Manages remote pinentry windows
import {invalidPasswordErrorString} from '@/constants/config'
import * as RemoteGen from '@/constants/remote-actions'
import * as T from '@/constants/types'
import {wrapErrors} from '@/constants/utils'
import {useEngineActionListener} from '@/engine/action-listener'
import logger from '@/logger'
import useBrowserWindow from '../desktop/remote/use-browser-window.desktop'
import useSerializeProps from '../desktop/remote/use-serialize-props.desktop'
import {useColorScheme} from 'react-native'
import * as React from 'react'
import {useConfigState} from '@/stores/config'
import type {ProxyProps} from './main2.desktop'
import {usePinentryRemoteAction} from './remote-actions.desktop'

const windowOpts = {height: 230, width: 440}
type PopupState = {
  cancelLabel?: string
  prompt: string
  retryLabel?: string
  showTyping?: T.RPCGen.Feature
  submitLabel?: string
  type: T.RPCGen.PassphraseType
  windowTitle: string
}

const initialPopupState = (): PopupState => ({
  cancelLabel: undefined,
  prompt: '',
  retryLabel: undefined,
  showTyping: undefined,
  submitLabel: undefined,
  type: T.RPCGen.PassphraseType.none,
  windowTitle: '',
})

const Pinentry = (p: ProxyProps) => {
  const windowComponent = 'pinentry'
  const windowParam = 'pinentry'

  useBrowserWindow({
    windowComponent,
    windowOpts,
    windowParam,
    windowTitle: 'Pinentry',
  })

  useSerializeProps(p, windowComponent, windowParam)
  return null
}

const PinentryProxy = () => {
  const [popupState, setPopupState] = React.useState(initialPopupState)
  const loggedIn = useConfigState(s => s.loggedIn)
  const handlersRef = React.useRef<{cancel?: () => void; submit?: (password: string) => void}>({})
  const clearPopup = React.useCallback(() => {
    handlersRef.current = {}
    setPopupState(initialPopupState())
  }, [])

  usePinentryRemoteAction(action => {
    switch (action.type) {
      case RemoteGen.pinentryOnCancel:
        handlersRef.current.cancel?.()
        break
      case RemoteGen.pinentryOnSubmit:
        handlersRef.current.submit?.(action.payload.password)
        break
    }
  })

  React.useEffect(() => {
    if (!loggedIn) {
      clearPopup()
    }
  }, [clearPopup, loggedIn])

  useEngineActionListener('keybase.1.secretUi.getPassphrase', action => {
    const {response, params} = action.payload
    const {pinentry} = params
    const {prompt, submitLabel, cancelLabel, windowTitle, features, type} = pinentry
    const showTyping = features.showTyping
    let {retryLabel} = pinentry
    if (retryLabel === invalidPasswordErrorString) {
      retryLabel = 'Incorrect password.'
    }
    logger.info('Asked for password')
    handlersRef.current = {
      cancel: wrapErrors(() => {
        response.error({code: T.RPCGen.StatusCode.scinputcanceled, desc: 'Input canceled'})
        clearPopup()
      }),
      submit: wrapErrors((password: string) => {
        response.result({passphrase: password, storeSecret: false})
        clearPopup()
      }),
    }
    setPopupState({
      cancelLabel,
      prompt,
      retryLabel,
      showTyping,
      submitLabel,
      type,
      windowTitle,
    })
  })

  const {cancelLabel, prompt, retryLabel, showTyping, submitLabel, type, windowTitle} = popupState
  const show = type !== T.RPCGen.PassphraseType.none && !!showTyping
  const darkMode = useColorScheme() === 'dark'
  if (show) {
    return (
      <Pinentry
        cancelLabel={cancelLabel}
        darkMode={darkMode}
        prompt={prompt}
        retryLabel={retryLabel}
        showTyping={showTyping}
        submitLabel={submitLabel}
        type={type}
        windowTitle={windowTitle}
      />
    )
  }
  return null
}

export default PinentryProxy
