import * as RPCTypes from '../constants/types/rpc-gen'
import * as Container from '../util/container'
import {WireProps} from './remote-proxy.desktop'

export const serialize: Container.RemoteWindowSerializeProps<WireProps> = {
  cancelLabel: (v?: string) => v,
  darkMode: (v: boolean) => v,
  prompt: (v: string) => v,
  retryLabel: (v?: string) => v,
  showTyping: (v: RPCTypes.Feature) => v,
  submitLabel: (v?: string) => v,
  type: (v: RPCTypes.PassphraseType) => v,
  windowComponent: (v: string) => v,
  windowOpts: (v: any) => v,
  windowPositionBottomRight: (v: boolean) => v,
  windowTitle: (v: string) => v,
}

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
  windowComponent: '',
  windowOpts: {},
  windowPositionBottomRight: false,
  windowTitle: '',
}

export const deserialize = (state: WireProps = initialState, props: any): WireProps => {
  if (!props) return state

  return {
    ...state,
    ...props,
  }
}
