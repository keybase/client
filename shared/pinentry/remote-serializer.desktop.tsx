import * as T from '../constants/types'
import type * as Constants from '../constants/pinentry'

export type ProxyProps = {
  darkMode: boolean
} & Constants.Store

type SerializeProps = ProxyProps
export type DeserializeProps = ProxyProps

const initialState: DeserializeProps = {
  darkMode: false,
  prompt: '',
  showTyping: {
    allow: false,
    defaultValue: false,
    label: '',
    readonly: false,
  },
  type: T.RPCGen.PassphraseType.none,
  windowTitle: '',
}

export const serialize = (p: ProxyProps): Partial<SerializeProps> => p

export const deserialize = (
  state: DeserializeProps = initialState,
  props: SerializeProps
): DeserializeProps => ({
  ...state,
  ...props,
})
