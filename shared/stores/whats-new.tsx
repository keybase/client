import type * as T from '@/constants/types'
import * as Z from '@/util/zustand'
import {uint8ArrayToString} from 'uint8array-extras'
import {currentVersion, lastVersion, lastLastVersion} from '@/constants/strings'
export {currentVersion, lastVersion, lastLastVersion, keybaseFM} from '@/constants/strings'

const noVersion: string = '0.0.0'
export {noVersion}

// This store has no dependencies on other stores and is safe to import directly from other stores.
type SeenVersionsMap = {[key in string]: boolean}

const semver = {
  gte: (a: string, b: string) => {
    const arra = a.split('.').map(i => parseInt(i))
    const [a1, a2, a3] = arra
    const arrb = b.split('.').map(i => parseInt(i))
    const [b1, b2, b3] = arrb
    if (arra.length === 3 && arrb.length === 3) {
      return a1! >= b1! && a2! >= b2! && a3! >= b3!
    } else {
      return false
    }
  },
  valid: (v: string) =>
    v.split('.').reduce((cnt, i) => {
      if (parseInt(i) >= 0) {
        return cnt + 1
      }
      return cnt
    }, 0) === 3,
}

const versions = [currentVersion, lastVersion, lastLastVersion, noVersion] as const

const isVersionValid = (version: string) => {
  return version ? semver.valid(version) : false
}

const getSeenVersions = (lastSeenVersion: string): SeenVersionsMap => {
  const initialMap: SeenVersionsMap = {
    [currentVersion]: true,
    [lastLastVersion]: true,
    [lastVersion]: true,
    [noVersion]: true,
  }

  if (!lastSeenVersion || !semver.valid(lastSeenVersion)) {
    return initialMap
  }
  if (lastSeenVersion === noVersion) {
    return {
      [currentVersion]: false,
      [lastLastVersion]: false,
      [lastVersion]: false,
      [noVersion]: false,
    }
  }

  const validVersions = versions.filter(isVersionValid)

  const seenVersions = validVersions.reduce(
    (acc, version) => ({
      ...acc,
      [version]: version === noVersion ? true : semver.gte(lastSeenVersion, version),
    }),
    initialMap
  )

  return seenVersions
}

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
export const useWhatsNewState = Z.createZustand<State>((set, get) => {
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
