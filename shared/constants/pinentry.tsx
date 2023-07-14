import * as Z from '../util/zustand'
import * as RPCTypes from './types/rpc-gen'
import logger from '../logger'
import * as ConfigConstants from './config'

export type Store = {
  cancelLabel?: string
  prompt: string
  retryLabel?: string
  showTyping?: RPCTypes.Feature
  submitLabel?: string
  type: RPCTypes.PassphraseType
  windowTitle: string
}
const initialStore: Store = {
  cancelLabel: undefined,
  prompt: '',
  retryLabel: undefined,
  showTyping: undefined,
  submitLabel: undefined,
  type: RPCTypes.PassphraseType.none,
  windowTitle: '',
}

type State = Store & {
  dispatch: {
    dynamic: {
      onCancel?: () => void
      onSubmit?: (password: string) => void
    }
    secretUIWantsPassphrase: (
      pinentry: RPCTypes.GUIEntryArg,
      response: {
        error: RPCTypes.IncomingErrorCallback
        result: (param: RPCTypes.GetPassphraseRes) => void
      }
    ) => void
    resetState: () => void
  }
}

export const useState = Z.createZustand<State>((set, get) => {
  const dispatch: State['dispatch'] = {
    dynamic: {
      onCancel: undefined,
      onSubmit: undefined,
    },
    resetState: () => {
      set(s => ({...s, ...initialStore, dispatch: s.dispatch}))
    },
    secretUIWantsPassphrase: (pinentry, response) => {
      const {prompt, submitLabel, cancelLabel, windowTitle, features, type} = pinentry
      const showTyping = features.showTyping
      let {retryLabel} = pinentry
      if (retryLabel === ConfigConstants.invalidPasswordErrorString) {
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
        s.dispatch.dynamic.onSubmit = (password: string) => {
          set(s => {
            s.dispatch.dynamic.onSubmit = undefined
          })
          response.result({passphrase: password, storeSecret: false})
          get().dispatch.resetState()
        }
        s.dispatch.dynamic.onCancel = () => {
          set(s => {
            s.dispatch.dynamic.onCancel = undefined
          })
          response.error({code: RPCTypes.StatusCode.scinputcanceled, desc: 'Input canceled'})
          get().dispatch.resetState()
        }
      })
    },
  }
  return {
    ...initialStore,
    dispatch,
  }
})
