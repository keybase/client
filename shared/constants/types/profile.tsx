import * as RPCTypes from './rpc-gen'
import {PlatformsExpandedType} from './more'
import {SiteIconSet} from './tracker2'

export type WebOfTrustVerificationType = 'none' | 'audio' | 'video' | 'email' | 'other_chat' | 'in_person'

export type ProveGenericParams = {
  readonly logoBlack: SiteIconSet
  readonly logoFull: SiteIconSet
  readonly title: string
  readonly subtext: string
  readonly suffix: string
  readonly buttonLabel: string
}

export type State = {
  readonly errorCode?: number
  readonly errorText: string
  readonly pgpErrorText: string
  readonly pgpEmail1: string
  readonly pgpEmail2: string
  readonly pgpEmail3: string
  readonly pgpErrorEmail1: boolean
  readonly pgpErrorEmail2: boolean
  readonly pgpErrorEmail3: boolean
  readonly pgpFullName: string
  readonly pgpPublicKey: string
  readonly platform?: PlatformsExpandedType
  readonly platformGeneric?: string
  readonly platformGenericChecking: boolean
  readonly platformGenericParams?: ProveGenericParams
  readonly platformGenericURL?: string
  readonly promptShouldStoreKeyOnServer: boolean
  readonly proofFound: boolean
  readonly proofStatus?: RPCTypes.ProofStatus
  readonly proofText: string
  readonly revokeError: string
  readonly blockUserModal?: 'waiting' | {error: string}
  readonly sigID?: RPCTypes.SigID
  readonly username: string
  readonly usernameValid: boolean
  readonly searchShowingSuggestions: boolean
}
