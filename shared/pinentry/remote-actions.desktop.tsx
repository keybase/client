import * as React from 'react'
import * as RemoteGen from '@/constants/remote-actions'

type PinentryRemoteAction = RemoteGen.PinentryOnCancelPayload | RemoteGen.PinentryOnSubmitPayload

const pinentryRemoteActionEvent = 'kb:pinentry-remote-action'

export const dispatchPinentryRemoteAction = (action: PinentryRemoteAction) => {
  if (typeof window === 'undefined') {
    return false
  }
  return window.dispatchEvent(new CustomEvent<PinentryRemoteAction>(pinentryRemoteActionEvent, {detail: action}))
}

export const subscribeToPinentryRemoteAction = (listener: (action: PinentryRemoteAction) => void) => {
  if (typeof window === 'undefined') {
    return () => {}
  }
  const onAction = (event: Event) => {
    listener((event as CustomEvent<PinentryRemoteAction>).detail)
  }
  window.addEventListener(pinentryRemoteActionEvent, onAction)
  return () => {
    window.removeEventListener(pinentryRemoteActionEvent, onAction)
  }
}

export const usePinentryRemoteAction = (listener: (action: PinentryRemoteAction) => void) => {
  const onAction = React.useEffectEvent(listener)
  React.useEffect(() => subscribeToPinentryRemoteAction(action => onAction(action)), [])
}
