import {runMode} from './platform'
// An ugly error message from the service that we'd like to rewrite ourselves.
export const invalidPasswordErrorString = 'Bad password: Invalid password. Server rejected login attempt..'

export const defaultKBFSPath = runMode === 'prod' ? '/keybase' : `/keybase.${runMode}`
export const defaultPrivatePrefix = '/private/'
export const defaultPublicPrefix = '/public/'
export const noKBFSFailReason = "Can't connect to KBFS"
const defaultTeamPrefix = '/team/'

export const privateFolderWithUsers = (users: ReadonlyArray<string>) =>
  `${defaultKBFSPath}${defaultPrivatePrefix}${[...new Set(users)].join(',')}`
export const publicFolderWithUsers = (users: ReadonlyArray<string>) =>
  `${defaultKBFSPath}${defaultPublicPrefix}${[...new Set(users)].join(',')}`
export const teamFolder = (team: string) => `${defaultKBFSPath}${defaultTeamPrefix}${team}`
