import * as RPCTypes from '../constants/types/rpc-gen'
import * as Container from '../util/container'
import {WireProps} from './remote-proxy.desktop'

export const serialize: Container.RemoteWindowSerializeProps<WireProps> = {
  darkMode: (v: boolean) => v,
  showTyping: (v: RPCTypes.Feature) => v,
  cancelLabel: (v?: string) => v,
  prompt: (v: string) => v,
  retryLabel: (v?: string) => v,
  submitLabel: (v?: string) => v,
  type: (v: RPCTypes.PassphraseType) => v,
  windowTitle: (v: string) => v,
  windowOpts: (v: any) => v,
  windowComponent: (v: string) => v,
  windowPositionBottomRight: (v: boolean) => v,
}

const initialState: WireProps = {
  darkMode: false,
  showTyping: {allow: false, defaultValue: false, readonly: false, label: ''},
  prompt: '',
  type: RPCTypes.PassphraseType.none,
  windowTitle: '',
  windowOpts: {},
  windowComponent: '',
  windowPositionBottomRight: false,
}

export const deserialize = (state: WireProps = initialState, props: any): WireProps => {
  if (!props) return state

  return {
    ...state,
    ...props,
  }
}
