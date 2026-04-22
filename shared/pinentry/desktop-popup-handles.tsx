import * as RemoteGen from '@/constants/remote-actions'
import {registerExternalResetter} from '@/util/zustand'

type PinentryPopupHandlers = {
  cancel: () => void
  submit: (password: string) => void
}

let handlers: PinentryPopupHandlers | undefined
const resetListeners = new Set<() => void>()

export const registerPinentryPopupHandlers = (nextHandlers: PinentryPopupHandlers) => {
  handlers = nextHandlers
  return () => {
    if (handlers === nextHandlers) {
      handlers = undefined
    }
  }
}

export const clearPinentryPopupHandlers = () => {
  handlers = undefined
  for (const listener of [...resetListeners]) {
    listener()
  }
}

export const subscribePinentryPopupReset = (listener: () => void) => {
  resetListeners.add(listener)
  return () => {
    resetListeners.delete(listener)
  }
}

export const handlePinentryPopupRemoteAction = (
  action: RemoteGen.PinentryOnCancelPayload | RemoteGen.PinentryOnSubmitPayload
) => {
  if (!handlers) {
    return false
  }
  switch (action.type) {
    case RemoteGen.pinentryOnCancel:
      handlers.cancel()
      return true
    case RemoteGen.pinentryOnSubmit:
      handlers.submit(action.payload.password)
      return true
  }
}

registerExternalResetter('pinentry-popup-handles', clearPinentryPopupHandlers)
