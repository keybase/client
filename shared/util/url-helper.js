// @flow
import keybaseUrl from '../constants/urls'

const linkFuncs = {
  home: () => keybaseUrl,
  help: () => `${keybaseUrl}/getting-started`,
  user: ({username}) => `${keybaseUrl}/${username || ''}`,
}

export function urlHelper(type: string, params: any): ?string {
  const linkFunc = linkFuncs[type]
  if (linkFunc) {
    const link = linkFunc(params)
    if (link) {
      return link
    }
  } else {
    console.warn(`No openURL handler for ${type}`, params)
  }
}
