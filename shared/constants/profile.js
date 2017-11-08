// @flow
import type {PlatformsExpandedType} from './types/more'

export type PgpInfo = {
  email1: ?string,
  email2: ?string,
  email3: ?string,
  errorText: ?string,
  fullName: ?string,
}

export type PgpInfoError = {
  errorText: ?string,
  errorEmail1: boolean,
  errorEmail2: boolean,
  errorEmail3: boolean,
}

export type State = {
  errorCode: ?number,
  errorText: ?string,
  pgpInfo: PgpInfo & PgpInfoError,
  pgpPublicKey: ?string,
  platform: ?PlatformsExpandedType,
  proofFound: boolean,
  proofStatus: ?ProofStatus,
  proofText: ?string,
  revoke: {
    error?: string,
    waiting?: boolean,
  },
  sigID: ?SigID,
  username: string,
  usernameValid: boolean,
  waiting: boolean,
  searchShowingSuggestions: boolean,
}

export const maxProfileBioChars = 256
