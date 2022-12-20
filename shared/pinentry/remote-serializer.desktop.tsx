import * as RPCTypes from '../constants/types/rpc-gen'
import type * as Types from '../constants/types/pinentry'

export type ProxyProps = {
  darkMode: boolean
} & Types.State

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
  type: RPCTypes.PassphraseType.none,
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
