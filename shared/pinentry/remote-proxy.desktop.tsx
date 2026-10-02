// Manages remote pinentry windows
import {invalidPasswordErrorString} from '@/constants/config'
import * as RemoteGen from '@/constants/remote-actions'
import * as T from '@/constants/types'
import {wrapErrors} from '@/constants/utils'
import {registerIncomingAnswerer} from '@/engine/incoming-answerers'
import {inputCanceledError} from '@/engine/types'
import logger from '@/logger'
import useBrowserWindow from '../desktop/remote/use-browser-window.desktop'
import useSerializeProps from '../desktop/remote/use-serialize-props.desktop'
import * as React from 'react'
import {useConfigState} from '@/stores/config'
import type {ProxyProps} from './main2.desktop'
import {registerRemoteActionHandler} from '@/desktop/renderer/remote-event-handler.desktop'

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
  const handlersRef = React.useRef<{
    cancel?: () => void
    // The held prompt, so a cancel from the engine can tell whether it is the one shown
    response?: unknown
    submit?: (password: string) => void
  }>({})
  const clearPopup = React.useCallback(() => {
    handlersRef.current = {}
    setPopupState(initialPopupState())
  }, [])

  React.useEffect(
    () =>
      registerRemoteActionHandler('pinentry', action => {
        switch (action.type) {
          case RemoteGen.pinentryOnCancel:
            handlersRef.current.cancel?.()
            break
          case RemoteGen.pinentryOnSubmit:
            handlersRef.current.submit?.(action.payload.password)
            break
        }
      }),
    []
  )

  React.useEffect(() => {
    if (!loggedIn) {
      // A held prompt still needs its answer, or the service waits on it forever
      handlersRef.current.cancel?.()
      handlersRef.current = {}
    }
  }, [loggedIn])

  React.useEffect(() => {
    const unregister = registerIncomingAnswerer(
      'keybase.1.secretUi.getPassphrase',
      (params, response) => {
        // The proxy only shows a prompt while logged in, so a held one would never be answered
        if (!useConfigState.getState().loggedIn) {
          response.error(inputCanceledError)
          return
        }
        const {pinentry} = params
        const {prompt, submitLabel, cancelLabel, windowTitle, features, type} = pinentry
        const showTyping = features.showTyping
        let {retryLabel} = pinentry
        if (retryLabel === invalidPasswordErrorString) {
          retryLabel = 'Incorrect password.'
        }
        logger.info('Asked for password')
        // Only one prompt is shown at a time; the one it replaces still needs its answer
        handlersRef.current.cancel?.()
        handlersRef.current = {
          cancel: wrapErrors(() => {
            response.error(inputCanceledError)
            clearPopup()
          }),
          response,
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
      },
      {
        // The service stopped waiting on the shown prompt, so nothing may answer it now
        onCancelled: response => {
          if (handlersRef.current.response === response) {
            clearPopup()
          }
        },
      }
    )
    return () => {
      // A prompt still held when the proxy goes away needs its answer, or the service waits forever
      handlersRef.current.cancel?.()
      unregister()
    }
  }, [clearPopup])

  const currentPopupState =
    !loggedIn && popupState.type !== T.RPCGen.PassphraseType.none ? initialPopupState() : popupState
  if (currentPopupState !== popupState) {
    setPopupState(currentPopupState)
  }
  const {cancelLabel, prompt, retryLabel, showTyping, submitLabel, type, windowTitle} = currentPopupState
  const show = type !== T.RPCGen.PassphraseType.none
  if (show) {
    return (
      <Pinentry
        cancelLabel={cancelLabel}
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
