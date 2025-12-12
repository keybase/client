import type * as T from '../types'
import * as Z from '@/util/zustand'
import {uint8ArrayToString} from 'uint8array-extras'
import {noVersion, getSeenVersions} from './utils'

export {currentVersion, lastVersion, lastLastVersion, keybaseFM} from './utils'

type SeenVersionsMap = {[key in string]: boolean}

type Store = T.Immutable<{
  lastSeenVersion: string
  seenVersions: SeenVersionsMap
}>
const initialStore: Store = {
  lastSeenVersion: '',
  seenVersions: getSeenVersions(''),
}
export interface State extends Store {
  dispatch: {
    resetState: 'default'
    updateLastSeen: (lastSeenItem?: {md: T.RPCGen.Gregor1.Metadata; item: T.RPCGen.Gregor1.Item}) => void
  }
  anyVersionsUnseen: () => boolean
}
export const useState = Z.createZustand<State>((set, get) => {
  const dispatch: State['dispatch'] = {
    resetState: 'default',
    updateLastSeen: lastSeenItem => {
      if (lastSeenItem) {
        const {body} = lastSeenItem.item
        const pushStateLastSeenVersion = uint8ArrayToString(body)
        const lastSeenVersion = pushStateLastSeenVersion || noVersion
        // Default to 0.0.0 (noVersion) if user has never marked a version as seen
        set(s => {
          s.lastSeenVersion = lastSeenVersion
          s.seenVersions = getSeenVersions(lastSeenVersion)
        })
      } else {
        set(s => {
          s.lastSeenVersion = noVersion
          s.seenVersions = getSeenVersions(noVersion)
        })
      }
    },
  }
  return {
    ...initialStore,
    anyVersionsUnseen: () => {
      const {lastSeenVersion: ver} = get()
      // On first load of what's new, lastSeenVersion == noVersion so everything is unseen
      return ver !== '' && ver === noVersion ? true : Object.values(getSeenVersions(ver)).some(seen => !seen)
    },
    dispatch,
  }
})
