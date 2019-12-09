export type NoVersion = '0.0.0'
export type CurrentVersion = '5.1.0'
export type LastVersion = '4.8.0'
export type LastLastVersion = NoVersion
export type WhatsNewVersion = CurrentVersion | LastVersion | LastLastVersion | NoVersion
export type WhatsNewVersions = [CurrentVersion, LastVersion, LastLastVersion]
