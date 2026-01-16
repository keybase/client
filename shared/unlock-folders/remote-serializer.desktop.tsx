import * as T from '@/constants/types'
import type * as ConfigConstants from '@/stores/config'
import {produce} from 'immer'

export type ProxyProps = {
  darkMode: boolean
  devices: ConfigConstants.State['unlockFoldersDevices']
  paperKeyError: string
  waiting: boolean
}

export type SerializeProps = ProxyProps
export type DeserializeProps = ProxyProps

const initialState: DeserializeProps = {
  darkMode: false,
  devices: [],
  paperKeyError: '',
  waiting: false,
}

export const serialize = (p: ProxyProps): Partial<SerializeProps> => p

export const deserialize = (
  state: DeserializeProps = initialState,
  props?: Partial<SerializeProps>
): DeserializeProps => {
  if (!props) return state

  const {darkMode, devices, paperKeyError, waiting} = props
  return produce(state, s => {
    if (darkMode !== undefined) {
      s.darkMode = darkMode
    }
    if (devices !== undefined) {
      s.devices = T.castDraft(devices)
    }
    if (paperKeyError !== undefined) {
      s.paperKeyError = paperKeyError
    }
    if (waiting !== undefined) {
      s.waiting = waiting
    }
  })
}
