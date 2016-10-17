// @flow
import type {PlatformsExpandedType, ProvablePlatformsType} from './types/more'
import type {ProofStatus, SigID, KID} from './types/flow-types'
import type {TypedAction, NoErrorTypedAction} from './types/flux'

const addProof = 'profile:addProof'
const askTextOrDNS = 'profile:askTextOrDNS'
const backToProfile = 'profile:backToProfile'
const cancelAddProof = 'profile:cancelAddProof'
const cancelPgpGen = 'profile:cancelPgpGen'
const checkProof = 'profile:checkProof'
// const checkSpecificProof = 'profile:checkSpecificProof'
const cleanupUsername = 'profile:cleanupUsername'
const dropPgp = 'profile:dropPgp'
const editProfile = 'profile:editProfile'
const editedProfile = 'profile:editedProfile'
const editingProfile = 'profile:editingProfile'
const finishRevokeProof = 'profile:revoke:finish'
const finishRevoking = 'profile:finishRevoking'
const finishedWithKeyGen = 'profile:FinishedWithKeyGen'
const generatePgp = 'profile:generatePgp'
const maxProfileBioChars = 256
const onClickAvatar = 'profile:onClickAvatar'
const onClickFollowers = 'profile:onClickFollowers'
const onClickFollowing = 'profile:onClickFollowing'
const onUserClick = 'profile:onUserClick'
const outputInstructionsActionLink = 'profile:outputInstructionsActionLink'
const registerBTC = 'profile:registerBTC'
const submitBTCAddress = 'profile:submitBTCAddress'
const submitRevokeProof = 'profile:submitRevokeProof'
const submitUsername = 'profile:submitUsername'
const updateErrorText = 'profile:updateErrorText'
const updatePgpInfo = 'profile:updatePgpInfo'
const updatePgpPublicKey = 'profile:updatePgpPublicKey'
const updatePlatform = 'profile:updatePlatform'
const updateProofStatus = 'profile:updateProofStatus'
const updateProofText = 'profile:updateProofText'
const updateSigID = 'profile:updateSigID'
const updateUsername = 'profile:updateUsername'
const waiting = 'profile:waiting'
const waitingRevokeProof = 'profile:revoke:waiting'
type AddProof = NoErrorTypedAction<'profile:addProof', {platform: PlatformsExpandedType}>
type AskTextOrDNS = NoErrorTypedAction<'profile:askTextOrDNS', void>
type BackToProfile = NoErrorTypedAction<'profile:backToProfile', void>
type CancelAddProof = NoErrorTypedAction<'profile:cancelAddProof', void>
type CancelPgpGen = NoErrorTypedAction<'profile:cancelPgpGen', {}>
type CheckProof = NoErrorTypedAction<'profile:checkProof', {sigID: ?string}>
// type CheckSpecificProof = NoErrorTypedAction<'profile:checkSpecificProof', {sigID: ?string}>
type CleanupUsername = TypedAction<'profile:cleanupUsername', void, void>
type DropPgp = TypedAction<'profile:dropPgp', {kid: KID}, {}>
type EditProfile = NoErrorTypedAction<'profile:editProfile', {bio: string, fullname: string, location: string}>
type FinishRevokeProof = TypedAction<'profile:revoke:finish', void, {error: string}>
type FinishRevoking = NoErrorTypedAction<'profile:finishRevoking', void>
type FinishedWithKeyGen = NoErrorTypedAction<'profile:FinishedWithKeyGen', {shouldStoreKeyOnServer: boolean}>
type GeneratePgp = TypedAction<'profile:generatePgp', void, void>
type OnClickAvatar = NoErrorTypedAction<'profile:onClickAvatar', {username: ?string, uid: string, openWebsite: ?boolean}>
type OnClickFollowers = NoErrorTypedAction<'profile:onClickFollowers', {username: ?string, uid: string, openWebsite: ?boolean}>
type OnClickFollowing = NoErrorTypedAction<'profile:onClickFollowing', {username: ?string, uid: string, openWebsite: ?boolean}>
type OnUserClick = NoErrorTypedAction<'profile:onUserClick', {username: string, uid: string}>
type OutputInstructionsActionLink = NoErrorTypedAction<'profile:outputInstructionsActionLink', void>
type RegisterBTC = NoErrorTypedAction<'profile:registerBTC', void>
type SubmitBTCAddress = NoErrorTypedAction<'profile:submitBTCAddress', void>
type SubmitRevokeProof = NoErrorTypedAction<'profile:submitRevokeProof', {proofId: string}>
type SubmitUsername = NoErrorTypedAction<'profile:submitUsername', void>
type UpdateErrorText = TypedAction<'profile:updateErrorText', {errorText: ?string, errorCode: ?number}, void>
type UpdatePgpInfo = TypedAction<'profile:updatePgpInfo', $Shape<PgpInfo>, PgpInfoError> // $Shape is meant here instead of exact, because you can supply only the parts you want to update
type UpdatePgpPublicKey = TypedAction<'profile:updatePgpPublicKey', {publicKey: string}, {}>
type UpdatePlatform = TypedAction<'profile:updatePlatform', {platform: PlatformsExpandedType}, void>
type UpdateProofStatus = TypedAction<'profile:updateProofStatus', {found: boolean, status: ProofStatus}, void>
type UpdateProofText = TypedAction<'profile:updateProofText', {proof: string}, void>
type UpdateSigID = TypedAction<'profile:updateSigID', {sigID: SigID}, void>
type UpdateUsername = TypedAction<'profile:updateUsername', {username: string}, void>
type Waiting = TypedAction<'profile:waiting', {waiting: boolean}, void>
type WaitingRevokeProof = TypedAction<'profile:revoke:waiting', {waiting: boolean}, void>

export type Actions = CleanupUsername
  | FinishRevokeProof
  | UpdateErrorText
  | UpdatePlatform
  | UpdateProofStatus
  | UpdateProofText
  | UpdateSigID
  | UpdateUsername
  | Waiting
  | WaitingRevokeProof

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
}

export {
  addProof,
  askTextOrDNS,
  backToProfile,
  cancelAddProof,
  cancelPgpGen,
  checkProof,
  // checkSpecificProof,
  cleanupUsername,
  dropPgp,
  editProfile,
  editedProfile,
  editingProfile,
  finishRevokeProof,
  finishRevoking,
  finishedWithKeyGen,
  generatePgp,
  maxProfileBioChars,
  onClickAvatar,
  onClickFollowers,
  onClickFollowing,
  onUserClick,
  outputInstructionsActionLink,
  registerBTC,
  submitBTCAddress,
  submitRevokeProof,
  submitUsername,
  updateErrorText,
  updatePgpInfo,
  updatePgpPublicKey,
  updatePlatform,
  updateProofStatus,
  updateProofText,
  updateSigID,
  updateUsername,
  waiting,
  waitingRevokeProof,
}

export type {
  AddProof,
  // AddServiceProof,
  AskTextOrDNS,
  BackToProfile,
  CancelAddProof,
  CancelPgpGen,
  CheckProof,
  // CheckSpecificProof,
  CleanupUsername,
  DropPgp,
  EditProfile,
  FinishRevokeProof,
  FinishRevoking,
  FinishedWithKeyGen,
  GeneratePgp,
  OnClickAvatar,
  OnClickFollowers,
  OnClickFollowing,
  OnUserClick,
  OutputInstructionsActionLink,
  RegisterBTC,
  SubmitBTCAddress,
  SubmitRevokeProof,
  SubmitUsername,
  UpdateErrorText,
  UpdatePgpInfo,
  UpdatePgpPublicKey,
  UpdatePlatform,
  UpdateProofStatus,
  UpdateProofText,
  UpdateSigID,
  UpdateUsername,
  Waiting,
  WaitingRevokeProof,
}
