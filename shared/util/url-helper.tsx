const linkFuncs = {
  help: () => `https://keybase.io/docs`,
  home: () => 'https://keybase.io',
  user: ({username}) => `https://keybase.io/${username || ''}`,
}

export function urlHelper(type: string, params?: any): string | undefined {
  const linkFunc = linkFuncs[type]
  if (linkFunc) {
    const link = linkFunc(params)
    if (link) {
      return link
    }
  } else {
    console.warn(`No openURL handler for ${type}`, params)
  }
  return undefined
}
