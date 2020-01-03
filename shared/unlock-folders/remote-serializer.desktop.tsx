import {Props} from './remote-proxy.desktop'

const initialState: Props = {
  darkMode: false,
  devices: [],
  phase: 'dead',
  waiting: false,
}

type SerializeProps = Props

export const serialize = (p: Props): SerializeProps => p

export const deserialize = (state: Props = initialState, props: SerializeProps): Props => ({
  ...state,
  ...props,
})
