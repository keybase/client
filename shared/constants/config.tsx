import {runMode} from './platform'

export const defaultKBFSPath = runMode === 'prod' ? '/keybase' : `/keybase.${runMode}`
export const defaultPrivatePrefix = '/private/'
const defaultTeamPrefix = '/team/'

export const privateFolderWithUsers = (users: ReadonlyArray<string>) =>
  `${defaultKBFSPath}${defaultPrivatePrefix}${[...new Set(users)].join(',')}`
export const teamFolder = (team: string) => `${defaultKBFSPath}${defaultTeamPrefix}${team}`
