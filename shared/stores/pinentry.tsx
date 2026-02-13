import * as Z from '@/util/zustand'
import * as EngineGen from '@/actions/engine-gen-gen'
import * as T from '@/constants/types'
import logger from '@/logger'
import {invalidPasswordErrorString} from '@/constants/config'
import {wrapErrors} from '@/constants/utils'

// This store has no dependencies on other stores and is safe to import directly from other stores.
export type Store = T.Immutable<{
  cancelLabel?: string
  prompt: string
  retryLabel?: string
  showTyping?: T.RPCGen.Feature
  submitLabel?: string
  type: T.RPCGen.PassphraseType
  windowTitle: string
}>
const initialStore: Store = {
  cancelLabel: undefined,
  prompt: '',
  retryLabel: undefined,
  showTyping: undefined,
  submitLabel: undefined,
  type: T.RPCGen.PassphraseType.none,
  windowTitle: '',
}

export interface State extends Store {
  dispatch: {
    dynamic: {
      onCancel?: () => void
      onSubmit?: (password: string) => void
    }
    secretUIWantsPassphrase: (
      pinentry: T.RPCGen.GUIEntryArg,
      response: {
        error: T.RPCGen.IncomingErrorCallback
        result: (param: T.RPCGen.GetPassphraseRes) => void
      }
    ) => void
    onEngineIncomingImpl: (action: EngineGen.Actions) => void
    resetState: () => void
  }
}

export const usePinentryState = Z.createZustand<State>((set, get) => {
  const dispatch: State['dispatch'] = {
    dynamic: {
      onCancel: undefined,
      onSubmit: undefined,
    },
    onEngineIncomingImpl: action => {
      switch (action.type) {
        case EngineGen.keybase1SecretUiGetPassphrase: {
          const {response, params} = action.payload
          const {pinentry} = params
          get().dispatch.secretUIWantsPassphrase(pinentry, response)
          break
        }
        default:
      }
    },
    resetState: () => {
      set(s => ({...s, ...initialStore, dispatch: s.dispatch}))
    },
    secretUIWantsPassphrase: (pinentry, response) => {
      const {prompt, submitLabel, cancelLabel, windowTitle, features, type} = pinentry
      const showTyping = features.showTyping
      let {retryLabel} = pinentry
      if (retryLabel === invalidPasswordErrorString) {
        retryLabel = 'Incorrect password.'
      }
      logger.info('Asked for password')
      set(s => {
        s.cancelLabel = cancelLabel
        s.prompt = prompt
        s.retryLabel = retryLabel
        s.showTyping = showTyping
        s.submitLabel = submitLabel
        s.type = type
        s.windowTitle = windowTitle
        s.dispatch.dynamic.onSubmit = wrapErrors((password: string) => {
          set(s => {
            s.dispatch.dynamic.onSubmit = undefined
          })
          response.result({passphrase: password, storeSecret: false})
          get().dispatch.resetState()
        })
        s.dispatch.dynamic.onCancel = wrapErrors(() => {
          set(s => {
            s.dispatch.dynamic.onCancel = undefined
          })
          response.error({code: T.RPCGen.StatusCode.scinputcanceled, desc: 'Input canceled'})
          get().dispatch.resetState()
        })
      })
    },
  }
  return {
    ...initialStore,
    dispatch,
  }
})
