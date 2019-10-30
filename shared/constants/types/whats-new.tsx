export type NoVersion = '0.0.0'
export type CurrentVersion = '4.8.0'
export type LastVersion = NoVersion
export type LastLastVersion = NoVersion
export type WhatsNewVersion = CurrentVersion | LastVersion | LastLastVersion | NoVersion
export type WhatsNewVersions = [CurrentVersion, LastVersion, LastLastVersion]

export type Feature = {
  primaryButtonText?: string
  secondaryButtonText?: string
  image?: string | null
}

export type FeatureWithSeenState = Feature & {seen: boolean}
