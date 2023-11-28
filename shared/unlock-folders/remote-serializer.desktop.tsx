import type * as ConfigConstants from '@/constants/config'
export type ProxyProps = {
  darkMode: boolean
  devices: ConfigConstants.Store['unlockFoldersDevices']
  paperKeyError: string
  waiting: boolean
}

type SerializeProps = ProxyProps
export type DeserializeProps = ProxyProps

const initialState: DeserializeProps = {
  darkMode: false,
  devices: [],
  paperKeyError: '',
  waiting: false,
}

export const serialize = (p: ProxyProps): Partial<SerializeProps> => p

export const deserialize = (
  _state: DeserializeProps | undefined,
  props: SerializeProps
): DeserializeProps => {
  const state = _state ?? initialState
  return {
    ...state,
    ...props,
  }
}
