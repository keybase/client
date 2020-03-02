export type NoVersion = '0.0.0'
export type CurrentVersion = '5.3.0'
export type LastVersion = '5.2.0'
export type LastLastVersion = '5.1.0'
export type WhatsNewVersion = CurrentVersion | LastVersion | LastLastVersion | NoVersion
export type WhatsNewVersions = [CurrentVersion, LastVersion, LastLastVersion, NoVersion]
