import semver from 'semver'
import {
  NoVersion,
  CurrentVersion,
  LastVersion,
  LastLastVersion,
  WhatsNewVersion,
  WhatsNewVersions,
} from './types/whats-new'

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

export const noVersion: NoVersion = '0.0.0'
export const currentVersion: CurrentVersion = '4.8.0'
export const lastVersion: LastVersion = '0.0.0'
export const lastLastVersion: LastLastVersion = '0.0.0'
export const versions: WhatsNewVersions = [currentVersion, lastVersion, lastLastVersion]
export const keybaseFM = 'Keybase FM 87.8'

type seenVersionsMap = {[key in WhatsNewVersion]: boolean}

export const isVersionValid = (version: string) => {
  return version ? semver.valid(version) : false
}

export const anyVersionsUnseen = (lastSeenVersion: string): boolean =>
  Object.values(getSeenVersions(lastSeenVersion)).some(seen => !seen)

export const getSeenVersions = (lastSeenVersion: string): seenVersionsMap => {
  // Mark all versions as seen so that the icon doesn't change as Gregor state is loading
  const initialMap: seenVersionsMap = {
    [currentVersion]: true,
    [lastLastVersion]: true,
    [lastVersion]: true,
  }

  // User has no entry in Gregor for lastSeenVersion, so mark all as unseen
  if (!lastSeenVersion || !semver.valid(lastSeenVersion)) {
    return initialMap
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
