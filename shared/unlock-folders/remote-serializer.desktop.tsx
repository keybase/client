import type {State} from '../constants/types/unlock-folders'
export type ProxyProps = {
  darkMode: boolean
} & Pick<State, 'devices' | 'paperkeyError' | 'phase' | 'waiting'>

type SerializeProps = ProxyProps
export type DeserializeProps = ProxyProps

const initialState: DeserializeProps = {
  darkMode: false,
  devices: [],
  phase: 'dead',
  waiting: false,
}

export const serialize = (p: ProxyProps): Partial<SerializeProps> => p

export const deserialize = (
  state: DeserializeProps = initialState,
  props: SerializeProps
): DeserializeProps => ({
  ...state,
  ...props,
})
