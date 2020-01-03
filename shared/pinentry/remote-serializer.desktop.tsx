import * as RPCTypes from '../constants/types/rpc-gen'
import {WireProps} from './remote-proxy.desktop'

export const serialize = (p: WireProps, _old: Partial<WireProps>): Partial<WireProps> => p

const initialState: WireProps = {
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

export const deserialize = (state: WireProps = initialState, props: Partial<WireProps>): WireProps => {
  if (!props) return state

  return {
    ...state,
    ...props,
    showTyping: {
      ...state.showTyping,
      ...props.showTyping,
    },
  }
}
