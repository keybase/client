import {WireProps} from './remote-proxy.desktop'

const initialState: WireProps = {
  darkMode: false,
  devices: [],
  phase: 'dead',
  waiting: false,
}

export const serialize = (p: WireProps): Partial<WireProps> => p

export const deserialize = (state: WireProps = initialState, props: Partial<WireProps>): WireProps => ({
  ...state,
  ...props,
})
