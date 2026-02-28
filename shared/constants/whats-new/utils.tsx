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

export const getSeenVersions = (lastSeenVersion: string): SeenVersionsMap => {
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

export {noVersion}

