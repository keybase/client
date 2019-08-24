export type ProvablePlatformsType =
  | 'dns'
  | 'facebook'
  | 'github'
  | 'hackernews'
  | 'http'
  | 'https'
  | 'reddit'
  | 'rooter'
  | 'twitter'
  | 'web'
  | 'rooter'

export const ProvablePlatforms: ReadonlyArray<ProvablePlatformsType> = [
  'dns',
  'facebook',
  'github',
  'hackernews',
  'http',
  'https',
  'reddit',
  'rooter',
  'twitter',
  'web',
  ...(__DEV__ ? ['rooter' as const] : []),
]

export type PlatformsExpandedType =
  | 'btc'
  | 'dns'
  | 'dnsOrGenericWebSite'
  | 'facebook'
  | 'github'
  | 'hackernews'
  | 'http'
  | 'https'
  | 'pgp'
  | 'reddit'
  | 'twitter'
  | 'web'
  | 'zcash'
  | 'rooter'

export const PlatformsExpanded = [
  'btc',
  'dns',
  'dnsOrGenericWebSite',
  'facebook',
  'github',
  'hackernews',
  'http',
  'https',
  'pgp',
  'reddit',
  'twitter',
  'web',
  'zcash',
  ...(__DEV__ ? ['rooter' as const] : []),
]

const isPlatformsExpandedType = (str: string): str is PlatformsExpandedType =>
  PlatformsExpanded.includes(str as any)
export const asPlatformsExpandedType = (str: string): PlatformsExpandedType | null =>
  isPlatformsExpandedType(str) ? str : null
