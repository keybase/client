import * as RPCTypes from '../constants/types/rpc-gen'
import {Props} from './remote-proxy.desktop'

const initialState: Props = {
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

type SerializeProps = Props

export const serialize = (p: Props): SerializeProps => p

export const deserialize = (state: Props = initialState, props: SerializeProps): Props => ({
  ...state,
  ...props,
})
