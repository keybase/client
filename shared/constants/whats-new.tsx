import type * as T from './types'
import * as Z from '@/util/zustand'
import {uint8ArrayToString} from 'uint8array-extras'

/*
 * IMPORTANT:
 *    1. currentVersion > lastVersion > lastLastVersion
 *    2. Must be semver compatible
 *    Source: https://semver.org/#is-there-a-suggested-regular-expression-regex-to-check-a-semver-string
 *
 * HOW TO ADD A NEW RELEASE
 *    1. lastLastVersion = lastVersion
 *    2. lastVersion = currentVersion
 *    3. currentVersion = new version of release
 *    4. Update string-literal types in shared/constants/types/whats-new
 *    5. Add as many NewFeatureRows as needed
 */

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

const noVersion: string = '0.0.0'
export const currentVersion: string = '5.5.0'
export const lastVersion: string = '5.4.0'
export const lastLastVersion: string = '5.3.0'
const versions = [currentVersion, lastVersion, lastLastVersion, noVersion] as const
export const keybaseFM = 'Keybase FM 87.7'

type SeenVersionsMap = {[key in string]: boolean}

const isVersionValid = (version: string) => {
  return version ? semver.valid(version) : false
}

const _getSeenVersions = (lastSeenVersion: string): SeenVersionsMap => {
  // Mark all versions as seen so that the icon doesn't change as Gregor state is loading
  const initialMap: SeenVersionsMap = {
    [currentVersion]: true,
    [lastLastVersion]: true,
    [lastVersion]: true,
    [noVersion]: true,
  }

  // lastSeenVersion hasn't loaded yet, so don't set a badge state
  if (!lastSeenVersion || !semver.valid(lastSeenVersion)) {
    return initialMap
  }
  // User has no entry in Gregor for lastSeenVersion, so mark all as unseen
  if (lastSeenVersion === noVersion) {
    return {
      [currentVersion]: false,
      [lastLastVersion]: false,
      [lastVersion]: false,
      [noVersion]: false,
    }
  }

  // last and lastLast versions might not be set
  const validVersions = versions.filter(isVersionValid)

  // Unseen versions are ones that are greater than the lastSeenVersion
  // seen =  lastLastVersion >= version
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
}>
const initialStore: Store = {
  lastSeenVersion: '',
}
interface State extends Store {
  dispatch: {
    resetState: 'default'
    updateLastSeen: (lastSeenItem?: {md: T.RPCGen.Gregor1.Metadata; item: T.RPCGen.Gregor1.Item}) => void
  }
  anyVersionsUnseen: () => boolean
  getSeenVersions: () => SeenVersionsMap
}
export const _useState = Z.createZustand<State>((set, get) => {
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
        })
      } else {
        set(s => {
          s.lastSeenVersion = noVersion
        })
      }
    },
  }
  return {
    ...initialStore,
    anyVersionsUnseen: () => {
      const {lastSeenVersion: ver} = get()
      // On first load of what's new, lastSeenVersion == noVersion so everything is unseen
      return ver !== '' && ver === noVersion ? true : Object.values(_getSeenVersions(ver)).some(seen => !seen)
    },
    dispatch,
    getSeenVersions: () => {
      return _getSeenVersions(get().lastSeenVersion)
    },
  }
})
