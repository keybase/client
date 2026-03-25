import type * as T from '@/constants/types'

export type RootLoginMode = 'hidden' | 'intro' | 'loading' | 'relogin'

type RootLoginState = {
  configuredAccountsLength: number
  handshakeState: T.Config.DaemonHandshakeState
  isLoggedIn: boolean
  userSwitching: boolean
}

type LoggedOutBannerState = {
  justDeletedSelf: string
  justRevokedSelf: string
}

export const needPasswordError = 'passphrase cannot be empty'

export const getRootLoginMode = ({
  configuredAccountsLength,
  handshakeState,
  isLoggedIn,
  userSwitching,
}: RootLoginState): RootLoginMode => {
  if (isLoggedIn) {
    return 'hidden'
  }
  if (handshakeState !== 'done' || userSwitching) {
    return 'loading'
  }
  if (configuredAccountsLength > 0) {
    return 'relogin'
  }
  return 'intro'
}

export const getLoggedOutBannerMessage = ({
  justDeletedSelf,
  justRevokedSelf,
}: LoggedOutBannerState): string => {
  if (justDeletedSelf) {
    return `Your Keybase account ${justDeletedSelf} has been deleted. Au revoir!`
  }
  if (justRevokedSelf) {
    return `${justRevokedSelf} was revoked successfully`
  }
  return ''
}

export const getReloginNeedPassword = (
  hasStoredSecret: boolean,
  promptedForPassword: boolean
): boolean => !hasStoredSecret || promptedForPassword

export const isNeedPasswordError = (error: string): boolean => error === needPasswordError
