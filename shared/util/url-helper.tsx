import keybaseUrl from '../constants/urls'

const linkFuncs = {
  help: () => `${keybaseUrl}/docs`,
  home: () => keybaseUrl,
  user: ({username}) => `${keybaseUrl}/${username || ''}`,
}

export function urlHelper(type: string, params?: any): string | null {
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
