import * as RPCTypes from '../constants/types/rpc-gen'
import {WireProps} from './remote-proxy.desktop'

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

export const serialize = (p: WireProps): Partial<WireProps> => p

export const deserialize = (state: WireProps = initialState, props: Partial<WireProps>): WireProps => ({
  ...state,
  ...props,
})
