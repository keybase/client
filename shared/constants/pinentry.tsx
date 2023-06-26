import * as Z from '../util/zustand'
import * as RPCTypes from './types/rpc-gen'
import logger from '../logger'

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

type GetPasswordParams = {
  response: {
    error: RPCTypes.IncomingErrorCallback
    result: (param: RPCTypes.GetPassphraseRes) => void
  }
  showTyping: RPCTypes.Feature
  type: RPCTypes.PassphraseType
  prompt: string
  windowTitle: string
  submitLabel?: string
  cancelLabel?: string
  retryLabel?: string
}

type State = Store & {
  dispatch: {
    onGetPassword: (p: GetPasswordParams) => void
    onCancel: () => void
    onSubmit: (password: string) => void
    resetState: () => void
  }
}

export const useState = Z.createZustand(
  Z.immerZustand<State>((set, get) => {
    const dispatch = {
      onCancel: () => {},
      onGetPassword: (p: GetPasswordParams) => {
        logger.info('Asked for password')
        const {response, showTyping, type, prompt, windowTitle, submitLabel, cancelLabel, retryLabel} = p

        set(s => {
          s.cancelLabel = cancelLabel
          s.prompt = prompt
          s.retryLabel = retryLabel
          s.showTyping = showTyping
          s.submitLabel = submitLabel
          s.type = type
          s.windowTitle = windowTitle
          s.dispatch.onSubmit = (password: string) => {
            response.result({passphrase: password, storeSecret: false})
            set(s => {
              s.dispatch.onSubmit = (_p: string) => {}
            })
            get().dispatch.resetState()
          }
          s.dispatch.onCancel = () => {
            response.error({code: RPCTypes.StatusCode.scinputcanceled, desc: 'Input canceled'})
            set(s => {
              s.dispatch.onCancel = () => {}
            })
            get().dispatch.resetState()
          }
        })
      },
      onSubmit: () => {},
      resetState: () => {
        set(s => ({...s, ...initialStore}))
      },
    }
    return {
      ...initialStore,
      dispatch,
    }
  })
)
