/* @flow */

export type int = number
export type long = number
export type double = number
export type bytes = any
export type BlockRefNonce = any
export type ED25519PublicKey = any
export type ED25519Signature = any
export type Time = number
export type SigID = string
export type account_Feature = {
  allow: boolean;
  defaultValue: boolean;
  readonly: boolean;
  label: string;
}

export type Feature = {
  allow: boolean;
  defaultValue: boolean;
  readonly: boolean;
  label: string;
}

export type account_GUIEntryFeatures = {
  storeSecret: Feature;
  showTyping: Feature;
}

export type GUIEntryFeatures = {
  storeSecret: Feature;
  showTyping: Feature;
}

export type account_GUIEntryArg = {
  windowTitle: string;
  prompt: string;
  submitLabel: string;
  cancelLabel: string;
  retryLabel: string;
  features: GUIEntryFeatures;
}

export type GUIEntryArg = {
  windowTitle: string;
  prompt: string;
  submitLabel: string;
  cancelLabel: string;
  retryLabel: string;
  features: GUIEntryFeatures;
}

export type account_GetPassphraseRes = {
  passphrase: string;
  storeSecret: boolean;
}

export type GetPassphraseRes = {
  passphrase: string;
  storeSecret: boolean;
}

export type block_Time = {
}

export type block_StringKVPair = {
  key: string;
  value: string;
}

export type StringKVPair = {
  key: string;
  value: string;
}

export type block_Status = {
  code: int;
  name: string;
  desc: string;
  fields: Array<StringKVPair>;
}

export type Status = {
  code: int;
  name: string;
  desc: string;
  fields: Array<StringKVPair>;
}

export type block_UID = {
}

export type UID = {
}

export type block_DeviceID = {
}

export type DeviceID = {
}

export type block_SigID = {
}

export type block_KID = {
}

export type KID = {
}

export type block_Text = {
  data: string;
  markup: boolean;
}

export type Text = {
  data: string;
  markup: boolean;
}

export type block_PGPIdentity = {
  username: string;
  comment: string;
  email: string;
}

export type PGPIdentity = {
  username: string;
  comment: string;
  email: string;
}

export type block_PublicKey = {
  KID: KID;
  PGPFingerprint: string;
  PGPIdentities: Array<PGPIdentity>;
  isSibkey: boolean;
  isEldest: boolean;
  parentID: string;
  deviceID: DeviceID;
  deviceDescription: string;
  deviceType: string;
  cTime: Time;
  eTime: Time;
}

export type PublicKey = {
  KID: KID;
  PGPFingerprint: string;
  PGPIdentities: Array<PGPIdentity>;
  isSibkey: boolean;
  isEldest: boolean;
  parentID: string;
  deviceID: DeviceID;
  deviceDescription: string;
  deviceType: string;
  cTime: Time;
  eTime: Time;
}

export type block_User = {
  uid: UID;
  username: string;
}

export type User = {
  uid: UID;
  username: string;
}

export type block_Device = {
  type: string;
  name: string;
  deviceID: DeviceID;
  cTime: Time;
  mTime: Time;
}

export type Device = {
  type: string;
  name: string;
  deviceID: DeviceID;
  cTime: Time;
  mTime: Time;
}

export type block_Stream = {
  fd: int;
}

export type Stream = {
  fd: int;
}

export type block_LogLevel = 0 /* 'NONE_0' */ | 1 /* 'DEBUG_1' */ | 2 /* 'INFO_2' */ | 3 /* 'NOTICE_3' */ | 4 /* 'WARN_4' */ | 5 /* 'ERROR_5' */ | 6 /* 'CRITICAL_6' */ | 7 /* 'FATAL_7' */

export type LogLevel = 0 /* 'NONE_0' */ | 1 /* 'DEBUG_1' */ | 2 /* 'INFO_2' */ | 3 /* 'NOTICE_3' */ | 4 /* 'WARN_4' */ | 5 /* 'ERROR_5' */ | 6 /* 'CRITICAL_6' */ | 7 /* 'FATAL_7' */

export type block_ClientType = 0 /* 'CLI_0' */ | 1 /* 'GUI_1' */

export type ClientType = 0 /* 'CLI_0' */ | 1 /* 'GUI_1' */

export type block_UserVersionVector = {
  id: long;
  sigHints: int;
  sigChain: long;
  cachedAt: Time;
  lastIdentifiedAt: Time;
}

export type UserVersionVector = {
  id: long;
  sigHints: int;
  sigChain: long;
  cachedAt: Time;
  lastIdentifiedAt: Time;
}

export type block_UserPlusKeys = {
  uid: UID;
  username: string;
  deviceKeys: Array<PublicKey>;
  keys: Array<PublicKey>;
  uvv: UserVersionVector;
}

export type UserPlusKeys = {
  uid: UID;
  username: string;
  deviceKeys: Array<PublicKey>;
  keys: Array<PublicKey>;
  uvv: UserVersionVector;
}

export type block_Asset = {
  name: string;
  url: string;
  localPath: string;
}

export type Asset = {
  name: string;
  url: string;
  localPath: string;
}

export type block_UpdateType = 0 /* 'NORMAL_0' */ | 1 /* 'BUGFIX_1' */ | 2 /* 'CRITICAL_2' */

export type UpdateType = 0 /* 'NORMAL_0' */ | 1 /* 'BUGFIX_1' */ | 2 /* 'CRITICAL_2' */

export type block_Update = {
  version: string;
  name: string;
  description: string;
  type: UpdateType;
  asset: Asset;
}

export type Update = {
  version: string;
  name: string;
  description: string;
  type: UpdateType;
  asset: Asset;
}

export type block_BlockIdCombo = {
  blockHash: string;
  chargedTo: UID;
}

export type BlockIdCombo = {
  blockHash: string;
  chargedTo: UID;
}

export type block_GetBlockRes = {
  blockKey: string;
  buf: bytes;
}

export type GetBlockRes = {
  blockKey: string;
  buf: bytes;
}

export type block_BlockReference = {
  bid: BlockIdCombo;
  nonce: BlockRefNonce;
  chargedTo: UID;
}

export type BlockReference = {
  bid: BlockIdCombo;
  nonce: BlockRefNonce;
  chargedTo: UID;
}

export type BTC_Time = {
}

export type BTC_StringKVPair = {
  key: string;
  value: string;
}

export type BTC_Status = {
  code: int;
  name: string;
  desc: string;
  fields: Array<StringKVPair>;
}

export type BTC_UID = {
}

export type BTC_DeviceID = {
}

export type BTC_SigID = {
}

export type BTC_KID = {
}

export type BTC_Text = {
  data: string;
  markup: boolean;
}

export type BTC_PGPIdentity = {
  username: string;
  comment: string;
  email: string;
}

export type BTC_PublicKey = {
  KID: KID;
  PGPFingerprint: string;
  PGPIdentities: Array<PGPIdentity>;
  isSibkey: boolean;
  isEldest: boolean;
  parentID: string;
  deviceID: DeviceID;
  deviceDescription: string;
  deviceType: string;
  cTime: Time;
  eTime: Time;
}

export type BTC_User = {
  uid: UID;
  username: string;
}

export type BTC_Device = {
  type: string;
  name: string;
  deviceID: DeviceID;
  cTime: Time;
  mTime: Time;
}

export type BTC_Stream = {
  fd: int;
}

export type BTC_LogLevel = 0 /* 'NONE_0' */ | 1 /* 'DEBUG_1' */ | 2 /* 'INFO_2' */ | 3 /* 'NOTICE_3' */ | 4 /* 'WARN_4' */ | 5 /* 'ERROR_5' */ | 6 /* 'CRITICAL_6' */ | 7 /* 'FATAL_7' */

export type BTC_ClientType = 0 /* 'CLI_0' */ | 1 /* 'GUI_1' */

export type BTC_UserVersionVector = {
  id: long;
  sigHints: int;
  sigChain: long;
  cachedAt: Time;
  lastIdentifiedAt: Time;
}

export type BTC_UserPlusKeys = {
  uid: UID;
  username: string;
  deviceKeys: Array<PublicKey>;
  keys: Array<PublicKey>;
  uvv: UserVersionVector;
}

export type BTC_Asset = {
  name: string;
  url: string;
  localPath: string;
}

export type BTC_UpdateType = 0 /* 'NORMAL_0' */ | 1 /* 'BUGFIX_1' */ | 2 /* 'CRITICAL_2' */

export type BTC_Update = {
  version: string;
  name: string;
  description: string;
  type: UpdateType;
  asset: Asset;
}

export type config_Time = {
}

export type config_StringKVPair = {
  key: string;
  value: string;
}

export type config_Status = {
  code: int;
  name: string;
  desc: string;
  fields: Array<StringKVPair>;
}

export type config_UID = {
}

export type config_DeviceID = {
}

export type config_SigID = {
}

export type config_KID = {
}

export type config_Text = {
  data: string;
  markup: boolean;
}

export type config_PGPIdentity = {
  username: string;
  comment: string;
  email: string;
}

export type config_PublicKey = {
  KID: KID;
  PGPFingerprint: string;
  PGPIdentities: Array<PGPIdentity>;
  isSibkey: boolean;
  isEldest: boolean;
  parentID: string;
  deviceID: DeviceID;
  deviceDescription: string;
  deviceType: string;
  cTime: Time;
  eTime: Time;
}

export type config_User = {
  uid: UID;
  username: string;
}

export type config_Device = {
  type: string;
  name: string;
  deviceID: DeviceID;
  cTime: Time;
  mTime: Time;
}

export type config_Stream = {
  fd: int;
}

export type config_LogLevel = 0 /* 'NONE_0' */ | 1 /* 'DEBUG_1' */ | 2 /* 'INFO_2' */ | 3 /* 'NOTICE_3' */ | 4 /* 'WARN_4' */ | 5 /* 'ERROR_5' */ | 6 /* 'CRITICAL_6' */ | 7 /* 'FATAL_7' */

export type config_ClientType = 0 /* 'CLI_0' */ | 1 /* 'GUI_1' */

export type config_UserVersionVector = {
  id: long;
  sigHints: int;
  sigChain: long;
  cachedAt: Time;
  lastIdentifiedAt: Time;
}

export type config_UserPlusKeys = {
  uid: UID;
  username: string;
  deviceKeys: Array<PublicKey>;
  keys: Array<PublicKey>;
  uvv: UserVersionVector;
}

export type config_Asset = {
  name: string;
  url: string;
  localPath: string;
}

export type config_UpdateType = 0 /* 'NORMAL_0' */ | 1 /* 'BUGFIX_1' */ | 2 /* 'CRITICAL_2' */

export type config_Update = {
  version: string;
  name: string;
  description: string;
  type: UpdateType;
  asset: Asset;
}

export type config_GetCurrentStatusRes = {
  configured: boolean;
  registered: boolean;
  loggedIn: boolean;
  user?: ?User;
}

export type GetCurrentStatusRes = {
  configured: boolean;
  registered: boolean;
  loggedIn: boolean;
  user?: ?User;
}

export type config_ForkType = 0 /* 'NONE_0' */ | 1 /* 'AUTO_1' */ | 2 /* 'WATCHDOG_2' */ | 3 /* 'LAUNCHD_3' */

export type ForkType = 0 /* 'NONE_0' */ | 1 /* 'AUTO_1' */ | 2 /* 'WATCHDOG_2' */ | 3 /* 'LAUNCHD_3' */

export type config_Config = {
  serverURI: string;
  socketFile: string;
  label: string;
  runMode: string;
  gpgExists: boolean;
  gpgPath: string;
  version: string;
  path: string;
  configPath: string;
  versionShort: string;
  versionFull: string;
  isAutoForked: boolean;
  forkType: ForkType;
}

export type Config = {
  serverURI: string;
  socketFile: string;
  label: string;
  runMode: string;
  gpgExists: boolean;
  gpgPath: string;
  version: string;
  path: string;
  configPath: string;
  versionShort: string;
  versionFull: string;
  isAutoForked: boolean;
  forkType: ForkType;
}

export type constants_StatusCode = 0 /* 'SCOk_0' */ | 1 /* 'SCLoginRequired_201' */ | 2 /* 'SCBadSession_202' */ | 3 /* 'SCBadLoginPassword_204' */ | 4 /* 'SCNotFound_205' */ | 5 /* 'SCGeneric_218' */ | 6 /* 'SCAlreadyLoggedIn_235' */ | 7 /* 'SCCanceled_237' */ | 8 /* 'SCReloginRequired_274' */ | 9 /* 'SCResolutionFailed_275' */ | 10 /* 'SCProfileNotPublic_276' */ | 11 /* 'SCBadSignupUsernameTaken_701' */ | 12 /* 'SCMissingResult_801' */ | 13 /* 'SCKeyNotFound_901' */ | 14 /* 'SCKeyInUse_907' */ | 15 /* 'SCKeyBadGen_913' */ | 16 /* 'SCKeyNoSecret_914' */ | 17 /* 'SCKeyBadUIDs_915' */ | 18 /* 'SCKeyNoActive_916' */ | 19 /* 'SCKeyNoSig_917' */ | 20 /* 'SCKeyBadSig_918' */ | 21 /* 'SCKeyBadEldest_919' */ | 22 /* 'SCKeyNoEldest_920' */ | 23 /* 'SCKeyDuplicateUpdate_921' */ | 24 /* 'SCSibkeyAlreadyExists_922' */ | 25 /* 'SCDecryptionKeyNotFound_924' */ | 26 /* 'SCBadTrackSession_1301' */ | 27 /* 'SCDeviceNotFound_1409' */ | 28 /* 'SCDeviceMismatch_1410' */ | 29 /* 'SCDeviceRequired_1411' */ | 30 /* 'SCStreamExists_1501' */ | 31 /* 'SCStreamNotFound_1502' */ | 32 /* 'SCStreamWrongKind_1503' */ | 33 /* 'SCStreamEOF_1504' */ | 34 /* 'SCAPINetworkError_1601' */ | 35 /* 'SCTimeout_1602' */ | 36 /* 'SCProofError_1701' */ | 37 /* 'SCIdentificationExpired_1702' */ | 38 /* 'SCSelfNotFound_1703' */ | 39 /* 'SCBadKexPhrase_1704' */ | 40 /* 'SCNoUIDelegation_1705' */

export type StatusCode = 0 /* 'SCOk_0' */ | 1 /* 'SCLoginRequired_201' */ | 2 /* 'SCBadSession_202' */ | 3 /* 'SCBadLoginPassword_204' */ | 4 /* 'SCNotFound_205' */ | 5 /* 'SCGeneric_218' */ | 6 /* 'SCAlreadyLoggedIn_235' */ | 7 /* 'SCCanceled_237' */ | 8 /* 'SCReloginRequired_274' */ | 9 /* 'SCResolutionFailed_275' */ | 10 /* 'SCProfileNotPublic_276' */ | 11 /* 'SCBadSignupUsernameTaken_701' */ | 12 /* 'SCMissingResult_801' */ | 13 /* 'SCKeyNotFound_901' */ | 14 /* 'SCKeyInUse_907' */ | 15 /* 'SCKeyBadGen_913' */ | 16 /* 'SCKeyNoSecret_914' */ | 17 /* 'SCKeyBadUIDs_915' */ | 18 /* 'SCKeyNoActive_916' */ | 19 /* 'SCKeyNoSig_917' */ | 20 /* 'SCKeyBadSig_918' */ | 21 /* 'SCKeyBadEldest_919' */ | 22 /* 'SCKeyNoEldest_920' */ | 23 /* 'SCKeyDuplicateUpdate_921' */ | 24 /* 'SCSibkeyAlreadyExists_922' */ | 25 /* 'SCDecryptionKeyNotFound_924' */ | 26 /* 'SCBadTrackSession_1301' */ | 27 /* 'SCDeviceNotFound_1409' */ | 28 /* 'SCDeviceMismatch_1410' */ | 29 /* 'SCDeviceRequired_1411' */ | 30 /* 'SCStreamExists_1501' */ | 31 /* 'SCStreamNotFound_1502' */ | 32 /* 'SCStreamWrongKind_1503' */ | 33 /* 'SCStreamEOF_1504' */ | 34 /* 'SCAPINetworkError_1601' */ | 35 /* 'SCTimeout_1602' */ | 36 /* 'SCProofError_1701' */ | 37 /* 'SCIdentificationExpired_1702' */ | 38 /* 'SCSelfNotFound_1703' */ | 39 /* 'SCBadKexPhrase_1704' */ | 40 /* 'SCNoUIDelegation_1705' */

export type crypto_ED25519SignatureInfo = {
  sig: ED25519Signature;
  publicKey: ED25519PublicKey;
}

export type ED25519SignatureInfo = {
  sig: ED25519Signature;
  publicKey: ED25519PublicKey;
}

export type ctl_Time = {
}

export type ctl_StringKVPair = {
  key: string;
  value: string;
}

export type ctl_Status = {
  code: int;
  name: string;
  desc: string;
  fields: Array<StringKVPair>;
}

export type ctl_UID = {
}

export type ctl_DeviceID = {
}

export type ctl_SigID = {
}

export type ctl_KID = {
}

export type ctl_Text = {
  data: string;
  markup: boolean;
}

export type ctl_PGPIdentity = {
  username: string;
  comment: string;
  email: string;
}

export type ctl_PublicKey = {
  KID: KID;
  PGPFingerprint: string;
  PGPIdentities: Array<PGPIdentity>;
  isSibkey: boolean;
  isEldest: boolean;
  parentID: string;
  deviceID: DeviceID;
  deviceDescription: string;
  deviceType: string;
  cTime: Time;
  eTime: Time;
}

export type ctl_User = {
  uid: UID;
  username: string;
}

export type ctl_Device = {
  type: string;
  name: string;
  deviceID: DeviceID;
  cTime: Time;
  mTime: Time;
}

export type ctl_Stream = {
  fd: int;
}

export type ctl_LogLevel = 0 /* 'NONE_0' */ | 1 /* 'DEBUG_1' */ | 2 /* 'INFO_2' */ | 3 /* 'NOTICE_3' */ | 4 /* 'WARN_4' */ | 5 /* 'ERROR_5' */ | 6 /* 'CRITICAL_6' */ | 7 /* 'FATAL_7' */

export type ctl_ClientType = 0 /* 'CLI_0' */ | 1 /* 'GUI_1' */

export type ctl_UserVersionVector = {
  id: long;
  sigHints: int;
  sigChain: long;
  cachedAt: Time;
  lastIdentifiedAt: Time;
}

export type ctl_UserPlusKeys = {
  uid: UID;
  username: string;
  deviceKeys: Array<PublicKey>;
  keys: Array<PublicKey>;
  uvv: UserVersionVector;
}

export type ctl_Asset = {
  name: string;
  url: string;
  localPath: string;
}

export type ctl_UpdateType = 0 /* 'NORMAL_0' */ | 1 /* 'BUGFIX_1' */ | 2 /* 'CRITICAL_2' */

export type ctl_Update = {
  version: string;
  name: string;
  description: string;
  type: UpdateType;
  asset: Asset;
}

export type ctl_ExitCode = 0 /* 'OK_0' */ | 1 /* 'NOTOK_2' */ | 2 /* 'RESTART_4' */

export type ExitCode = 0 /* 'OK_0' */ | 1 /* 'NOTOK_2' */ | 2 /* 'RESTART_4' */

export type debugging_FirstStepResult = {
  valPlusTwo: int;
}

export type FirstStepResult = {
  valPlusTwo: int;
}

export type delegateUiCtl_Time = {
}

export type delegateUiCtl_StringKVPair = {
  key: string;
  value: string;
}

export type delegateUiCtl_Status = {
  code: int;
  name: string;
  desc: string;
  fields: Array<StringKVPair>;
}

export type delegateUiCtl_UID = {
}

export type delegateUiCtl_DeviceID = {
}

export type delegateUiCtl_SigID = {
}

export type delegateUiCtl_KID = {
}

export type delegateUiCtl_Text = {
  data: string;
  markup: boolean;
}

export type delegateUiCtl_PGPIdentity = {
  username: string;
  comment: string;
  email: string;
}

export type delegateUiCtl_PublicKey = {
  KID: KID;
  PGPFingerprint: string;
  PGPIdentities: Array<PGPIdentity>;
  isSibkey: boolean;
  isEldest: boolean;
  parentID: string;
  deviceID: DeviceID;
  deviceDescription: string;
  deviceType: string;
  cTime: Time;
  eTime: Time;
}

export type delegateUiCtl_User = {
  uid: UID;
  username: string;
}

export type delegateUiCtl_Device = {
  type: string;
  name: string;
  deviceID: DeviceID;
  cTime: Time;
  mTime: Time;
}

export type delegateUiCtl_Stream = {
  fd: int;
}

export type delegateUiCtl_LogLevel = 0 /* 'NONE_0' */ | 1 /* 'DEBUG_1' */ | 2 /* 'INFO_2' */ | 3 /* 'NOTICE_3' */ | 4 /* 'WARN_4' */ | 5 /* 'ERROR_5' */ | 6 /* 'CRITICAL_6' */ | 7 /* 'FATAL_7' */

export type delegateUiCtl_ClientType = 0 /* 'CLI_0' */ | 1 /* 'GUI_1' */

export type delegateUiCtl_UserVersionVector = {
  id: long;
  sigHints: int;
  sigChain: long;
  cachedAt: Time;
  lastIdentifiedAt: Time;
}

export type delegateUiCtl_UserPlusKeys = {
  uid: UID;
  username: string;
  deviceKeys: Array<PublicKey>;
  keys: Array<PublicKey>;
  uvv: UserVersionVector;
}

export type delegateUiCtl_Asset = {
  name: string;
  url: string;
  localPath: string;
}

export type delegateUiCtl_UpdateType = 0 /* 'NORMAL_0' */ | 1 /* 'BUGFIX_1' */ | 2 /* 'CRITICAL_2' */

export type delegateUiCtl_Update = {
  version: string;
  name: string;
  description: string;
  type: UpdateType;
  asset: Asset;
}

export type device_Time = {
}

export type device_StringKVPair = {
  key: string;
  value: string;
}

export type device_Status = {
  code: int;
  name: string;
  desc: string;
  fields: Array<StringKVPair>;
}

export type device_UID = {
}

export type device_DeviceID = {
}

export type device_SigID = {
}

export type device_KID = {
}

export type device_Text = {
  data: string;
  markup: boolean;
}

export type device_PGPIdentity = {
  username: string;
  comment: string;
  email: string;
}

export type device_PublicKey = {
  KID: KID;
  PGPFingerprint: string;
  PGPIdentities: Array<PGPIdentity>;
  isSibkey: boolean;
  isEldest: boolean;
  parentID: string;
  deviceID: DeviceID;
  deviceDescription: string;
  deviceType: string;
  cTime: Time;
  eTime: Time;
}

export type device_User = {
  uid: UID;
  username: string;
}

export type device_Device = {
  type: string;
  name: string;
  deviceID: DeviceID;
  cTime: Time;
  mTime: Time;
}

export type device_Stream = {
  fd: int;
}

export type device_LogLevel = 0 /* 'NONE_0' */ | 1 /* 'DEBUG_1' */ | 2 /* 'INFO_2' */ | 3 /* 'NOTICE_3' */ | 4 /* 'WARN_4' */ | 5 /* 'ERROR_5' */ | 6 /* 'CRITICAL_6' */ | 7 /* 'FATAL_7' */

export type device_ClientType = 0 /* 'CLI_0' */ | 1 /* 'GUI_1' */

export type device_UserVersionVector = {
  id: long;
  sigHints: int;
  sigChain: long;
  cachedAt: Time;
  lastIdentifiedAt: Time;
}

export type device_UserPlusKeys = {
  uid: UID;
  username: string;
  deviceKeys: Array<PublicKey>;
  keys: Array<PublicKey>;
  uvv: UserVersionVector;
}

export type device_Asset = {
  name: string;
  url: string;
  localPath: string;
}

export type device_UpdateType = 0 /* 'NORMAL_0' */ | 1 /* 'BUGFIX_1' */ | 2 /* 'CRITICAL_2' */

export type device_Update = {
  version: string;
  name: string;
  description: string;
  type: UpdateType;
  asset: Asset;
}

export type favorite_Time = {
}

export type favorite_StringKVPair = {
  key: string;
  value: string;
}

export type favorite_Status = {
  code: int;
  name: string;
  desc: string;
  fields: Array<StringKVPair>;
}

export type favorite_UID = {
}

export type favorite_DeviceID = {
}

export type favorite_SigID = {
}

export type favorite_KID = {
}

export type favorite_Text = {
  data: string;
  markup: boolean;
}

export type favorite_PGPIdentity = {
  username: string;
  comment: string;
  email: string;
}

export type favorite_PublicKey = {
  KID: KID;
  PGPFingerprint: string;
  PGPIdentities: Array<PGPIdentity>;
  isSibkey: boolean;
  isEldest: boolean;
  parentID: string;
  deviceID: DeviceID;
  deviceDescription: string;
  deviceType: string;
  cTime: Time;
  eTime: Time;
}

export type favorite_User = {
  uid: UID;
  username: string;
}

export type favorite_Device = {
  type: string;
  name: string;
  deviceID: DeviceID;
  cTime: Time;
  mTime: Time;
}

export type favorite_Stream = {
  fd: int;
}

export type favorite_LogLevel = 0 /* 'NONE_0' */ | 1 /* 'DEBUG_1' */ | 2 /* 'INFO_2' */ | 3 /* 'NOTICE_3' */ | 4 /* 'WARN_4' */ | 5 /* 'ERROR_5' */ | 6 /* 'CRITICAL_6' */ | 7 /* 'FATAL_7' */

export type favorite_ClientType = 0 /* 'CLI_0' */ | 1 /* 'GUI_1' */

export type favorite_UserVersionVector = {
  id: long;
  sigHints: int;
  sigChain: long;
  cachedAt: Time;
  lastIdentifiedAt: Time;
}

export type favorite_UserPlusKeys = {
  uid: UID;
  username: string;
  deviceKeys: Array<PublicKey>;
  keys: Array<PublicKey>;
  uvv: UserVersionVector;
}

export type favorite_Asset = {
  name: string;
  url: string;
  localPath: string;
}

export type favorite_UpdateType = 0 /* 'NORMAL_0' */ | 1 /* 'BUGFIX_1' */ | 2 /* 'CRITICAL_2' */

export type favorite_Update = {
  version: string;
  name: string;
  description: string;
  type: UpdateType;
  asset: Asset;
}

export type favorite_Folder = {
  name: string;
  private: boolean;
  notificationsOn: boolean;
}

export type Folder = {
  name: string;
  private: boolean;
  notificationsOn: boolean;
}

export type gpgUi_Time = {
}

export type gpgUi_StringKVPair = {
  key: string;
  value: string;
}

export type gpgUi_Status = {
  code: int;
  name: string;
  desc: string;
  fields: Array<StringKVPair>;
}

export type gpgUi_UID = {
}

export type gpgUi_DeviceID = {
}

export type gpgUi_SigID = {
}

export type gpgUi_KID = {
}

export type gpgUi_Text = {
  data: string;
  markup: boolean;
}

export type gpgUi_PGPIdentity = {
  username: string;
  comment: string;
  email: string;
}

export type gpgUi_PublicKey = {
  KID: KID;
  PGPFingerprint: string;
  PGPIdentities: Array<PGPIdentity>;
  isSibkey: boolean;
  isEldest: boolean;
  parentID: string;
  deviceID: DeviceID;
  deviceDescription: string;
  deviceType: string;
  cTime: Time;
  eTime: Time;
}

export type gpgUi_User = {
  uid: UID;
  username: string;
}

export type gpgUi_Device = {
  type: string;
  name: string;
  deviceID: DeviceID;
  cTime: Time;
  mTime: Time;
}

export type gpgUi_Stream = {
  fd: int;
}

export type gpgUi_LogLevel = 0 /* 'NONE_0' */ | 1 /* 'DEBUG_1' */ | 2 /* 'INFO_2' */ | 3 /* 'NOTICE_3' */ | 4 /* 'WARN_4' */ | 5 /* 'ERROR_5' */ | 6 /* 'CRITICAL_6' */ | 7 /* 'FATAL_7' */

export type gpgUi_ClientType = 0 /* 'CLI_0' */ | 1 /* 'GUI_1' */

export type gpgUi_UserVersionVector = {
  id: long;
  sigHints: int;
  sigChain: long;
  cachedAt: Time;
  lastIdentifiedAt: Time;
}

export type gpgUi_UserPlusKeys = {
  uid: UID;
  username: string;
  deviceKeys: Array<PublicKey>;
  keys: Array<PublicKey>;
  uvv: UserVersionVector;
}

export type gpgUi_Asset = {
  name: string;
  url: string;
  localPath: string;
}

export type gpgUi_UpdateType = 0 /* 'NORMAL_0' */ | 1 /* 'BUGFIX_1' */ | 2 /* 'CRITICAL_2' */

export type gpgUi_Update = {
  version: string;
  name: string;
  description: string;
  type: UpdateType;
  asset: Asset;
}

export type gpgUi_GPGKey = {
  algorithm: string;
  keyID: string;
  creation: string;
  expiration: string;
  identities: Array<PGPIdentity>;
}

export type GPGKey = {
  algorithm: string;
  keyID: string;
  creation: string;
  expiration: string;
  identities: Array<PGPIdentity>;
}

export type gpgUi_SelectKeyRes = {
  keyID: string;
  doSecretPush: boolean;
}

export type SelectKeyRes = {
  keyID: string;
  doSecretPush: boolean;
}

export type identify_Time = {
}

export type identify_StringKVPair = {
  key: string;
  value: string;
}

export type identify_Status = {
  code: int;
  name: string;
  desc: string;
  fields: Array<StringKVPair>;
}

export type identify_UID = {
}

export type identify_DeviceID = {
}

export type identify_SigID = {
}

export type identify_KID = {
}

export type identify_Text = {
  data: string;
  markup: boolean;
}

export type identify_PGPIdentity = {
  username: string;
  comment: string;
  email: string;
}

export type identify_PublicKey = {
  KID: KID;
  PGPFingerprint: string;
  PGPIdentities: Array<PGPIdentity>;
  isSibkey: boolean;
  isEldest: boolean;
  parentID: string;
  deviceID: DeviceID;
  deviceDescription: string;
  deviceType: string;
  cTime: Time;
  eTime: Time;
}

export type identify_User = {
  uid: UID;
  username: string;
}

export type identify_Device = {
  type: string;
  name: string;
  deviceID: DeviceID;
  cTime: Time;
  mTime: Time;
}

export type identify_Stream = {
  fd: int;
}

export type identify_LogLevel = 0 /* 'NONE_0' */ | 1 /* 'DEBUG_1' */ | 2 /* 'INFO_2' */ | 3 /* 'NOTICE_3' */ | 4 /* 'WARN_4' */ | 5 /* 'ERROR_5' */ | 6 /* 'CRITICAL_6' */ | 7 /* 'FATAL_7' */

export type identify_ClientType = 0 /* 'CLI_0' */ | 1 /* 'GUI_1' */

export type identify_UserVersionVector = {
  id: long;
  sigHints: int;
  sigChain: long;
  cachedAt: Time;
  lastIdentifiedAt: Time;
}

export type identify_UserPlusKeys = {
  uid: UID;
  username: string;
  deviceKeys: Array<PublicKey>;
  keys: Array<PublicKey>;
  uvv: UserVersionVector;
}

export type identify_Asset = {
  name: string;
  url: string;
  localPath: string;
}

export type identify_UpdateType = 0 /* 'NORMAL_0' */ | 1 /* 'BUGFIX_1' */ | 2 /* 'CRITICAL_2' */

export type identify_Update = {
  version: string;
  name: string;
  description: string;
  type: UpdateType;
  asset: Asset;
}

export type identify_ProofState = 0 /* 'NONE_0' */ | 1 /* 'OK_1' */ | 2 /* 'TEMP_FAILURE_2' */ | 3 /* 'PERM_FAILURE_3' */ | 4 /* 'LOOKING_4' */ | 5 /* 'SUPERSEDED_5' */ | 6 /* 'POSTED_6' */ | 7 /* 'REVOKED_7' */

export type ProofState = 0 /* 'NONE_0' */ | 1 /* 'OK_1' */ | 2 /* 'TEMP_FAILURE_2' */ | 3 /* 'PERM_FAILURE_3' */ | 4 /* 'LOOKING_4' */ | 5 /* 'SUPERSEDED_5' */ | 6 /* 'POSTED_6' */ | 7 /* 'REVOKED_7' */

export type identify_ProofStatus = 0 /* 'NONE_0' */ | 1 /* 'OK_1' */ | 2 /* 'LOCAL_2' */ | 3 /* 'FOUND_3' */ | 4 /* 'BASE_ERROR_100' */ | 5 /* 'HOST_UNREACHABLE_101' */ | 6 /* 'PERMISSION_DENIED_103' */ | 7 /* 'FAILED_PARSE_106' */ | 8 /* 'DNS_ERROR_107' */ | 9 /* 'AUTH_FAILED_108' */ | 10 /* 'HTTP_500_150' */ | 11 /* 'TIMEOUT_160' */ | 12 /* 'INTERNAL_ERROR_170' */ | 13 /* 'BASE_HARD_ERROR_200' */ | 14 /* 'NOT_FOUND_201' */ | 15 /* 'CONTENT_FAILURE_202' */ | 16 /* 'BAD_USERNAME_203' */ | 17 /* 'BAD_REMOTE_ID_204' */ | 18 /* 'TEXT_NOT_FOUND_205' */ | 19 /* 'BAD_ARGS_206' */ | 20 /* 'CONTENT_MISSING_207' */ | 21 /* 'TITLE_NOT_FOUND_208' */ | 22 /* 'SERVICE_ERROR_209' */ | 23 /* 'TOR_SKIPPED_210' */ | 24 /* 'TOR_INCOMPATIBLE_211' */ | 25 /* 'HTTP_300_230' */ | 26 /* 'HTTP_400_240' */ | 27 /* 'HTTP_OTHER_260' */ | 28 /* 'EMPTY_JSON_270' */ | 29 /* 'DELETED_301' */ | 30 /* 'SERVICE_DEAD_302' */ | 31 /* 'BAD_SIGNATURE_303' */ | 32 /* 'BAD_API_URL_304' */ | 33 /* 'UNKNOWN_TYPE_305' */ | 34 /* 'NO_HINT_306' */ | 35 /* 'BAD_HINT_TEXT_307' */

export type ProofStatus = 0 /* 'NONE_0' */ | 1 /* 'OK_1' */ | 2 /* 'LOCAL_2' */ | 3 /* 'FOUND_3' */ | 4 /* 'BASE_ERROR_100' */ | 5 /* 'HOST_UNREACHABLE_101' */ | 6 /* 'PERMISSION_DENIED_103' */ | 7 /* 'FAILED_PARSE_106' */ | 8 /* 'DNS_ERROR_107' */ | 9 /* 'AUTH_FAILED_108' */ | 10 /* 'HTTP_500_150' */ | 11 /* 'TIMEOUT_160' */ | 12 /* 'INTERNAL_ERROR_170' */ | 13 /* 'BASE_HARD_ERROR_200' */ | 14 /* 'NOT_FOUND_201' */ | 15 /* 'CONTENT_FAILURE_202' */ | 16 /* 'BAD_USERNAME_203' */ | 17 /* 'BAD_REMOTE_ID_204' */ | 18 /* 'TEXT_NOT_FOUND_205' */ | 19 /* 'BAD_ARGS_206' */ | 20 /* 'CONTENT_MISSING_207' */ | 21 /* 'TITLE_NOT_FOUND_208' */ | 22 /* 'SERVICE_ERROR_209' */ | 23 /* 'TOR_SKIPPED_210' */ | 24 /* 'TOR_INCOMPATIBLE_211' */ | 25 /* 'HTTP_300_230' */ | 26 /* 'HTTP_400_240' */ | 27 /* 'HTTP_OTHER_260' */ | 28 /* 'EMPTY_JSON_270' */ | 29 /* 'DELETED_301' */ | 30 /* 'SERVICE_DEAD_302' */ | 31 /* 'BAD_SIGNATURE_303' */ | 32 /* 'BAD_API_URL_304' */ | 33 /* 'UNKNOWN_TYPE_305' */ | 34 /* 'NO_HINT_306' */ | 35 /* 'BAD_HINT_TEXT_307' */

export type identify_ProofType = 0 /* 'NONE_0' */ | 1 /* 'KEYBASE_1' */ | 2 /* 'TWITTER_2' */ | 3 /* 'GITHUB_3' */ | 4 /* 'REDDIT_4' */ | 5 /* 'COINBASE_5' */ | 6 /* 'HACKERNEWS_6' */ | 7 /* 'GENERIC_WEB_SITE_1000' */ | 8 /* 'DNS_1001' */ | 9 /* 'ROOTER_100001' */

export type ProofType = 0 /* 'NONE_0' */ | 1 /* 'KEYBASE_1' */ | 2 /* 'TWITTER_2' */ | 3 /* 'GITHUB_3' */ | 4 /* 'REDDIT_4' */ | 5 /* 'COINBASE_5' */ | 6 /* 'HACKERNEWS_6' */ | 7 /* 'GENERIC_WEB_SITE_1000' */ | 8 /* 'DNS_1001' */ | 9 /* 'ROOTER_100001' */

export type identify_TrackToken = {
}

export type TrackToken = {
}

export type identify_TrackDiffType = 0 /* 'NONE_0' */ | 1 /* 'ERROR_1' */ | 2 /* 'CLASH_2' */ | 3 /* 'REVOKED_3' */ | 4 /* 'UPGRADED_4' */ | 5 /* 'NEW_5' */ | 6 /* 'REMOTE_FAIL_6' */ | 7 /* 'REMOTE_WORKING_7' */ | 8 /* 'REMOTE_CHANGED_8' */ | 9 /* 'NEW_ELDEST_9' */

export type TrackDiffType = 0 /* 'NONE_0' */ | 1 /* 'ERROR_1' */ | 2 /* 'CLASH_2' */ | 3 /* 'REVOKED_3' */ | 4 /* 'UPGRADED_4' */ | 5 /* 'NEW_5' */ | 6 /* 'REMOTE_FAIL_6' */ | 7 /* 'REMOTE_WORKING_7' */ | 8 /* 'REMOTE_CHANGED_8' */ | 9 /* 'NEW_ELDEST_9' */

export type identify_TrackDiff = {
  type: TrackDiffType;
  displayMarkup: string;
}

export type TrackDiff = {
  type: TrackDiffType;
  displayMarkup: string;
}

export type identify_TrackSummary = {
  username: string;
  time: Time;
  isRemote: boolean;
}

export type TrackSummary = {
  username: string;
  time: Time;
  isRemote: boolean;
}

export type identify_TrackStatus = 0 /* 'NEW_OK_1' */ | 1 /* 'NEW_ZERO_PROOFS_2' */ | 2 /* 'NEW_FAIL_PROOFS_3' */ | 3 /* 'UPDATE_BROKEN_4' */ | 4 /* 'UPDATE_NEW_PROOFS_5' */ | 5 /* 'UPDATE_OK_6' */

export type TrackStatus = 0 /* 'NEW_OK_1' */ | 1 /* 'NEW_ZERO_PROOFS_2' */ | 2 /* 'NEW_FAIL_PROOFS_3' */ | 3 /* 'UPDATE_BROKEN_4' */ | 4 /* 'UPDATE_NEW_PROOFS_5' */ | 5 /* 'UPDATE_OK_6' */

export type identify_TrackOptions = {
  localOnly: boolean;
  bypassConfirm: boolean;
}

export type TrackOptions = {
  localOnly: boolean;
  bypassConfirm: boolean;
}

export type identify_IdentifyReason = {
  reason: string;
}

export type IdentifyReason = {
  reason: string;
}

export type identify_IdentifyOutcome = {
  username: string;
  status?: ?Status;
  warnings: Array<string>;
  trackUsed?: ?TrackSummary;
  trackStatus: TrackStatus;
  numTrackFailures: int;
  numTrackChanges: int;
  numProofFailures: int;
  numRevoked: int;
  numProofSuccesses: int;
  revoked: Array<TrackDiff>;
  trackOptions: TrackOptions;
  forPGPPull: boolean;
  reason: IdentifyReason;
}

export type IdentifyOutcome = {
  username: string;
  status?: ?Status;
  warnings: Array<string>;
  trackUsed?: ?TrackSummary;
  trackStatus: TrackStatus;
  numTrackFailures: int;
  numTrackChanges: int;
  numProofFailures: int;
  numRevoked: int;
  numProofSuccesses: int;
  revoked: Array<TrackDiff>;
  trackOptions: TrackOptions;
  forPGPPull: boolean;
  reason: IdentifyReason;
}

export type identify_IdentifyRes = {
  user?: ?User;
  publicKeys: Array<PublicKey>;
  outcome: IdentifyOutcome;
  trackToken: TrackToken;
}

export type IdentifyRes = {
  user?: ?User;
  publicKeys: Array<PublicKey>;
  outcome: IdentifyOutcome;
  trackToken: TrackToken;
}

export type identify_RemoteProof = {
  proofType: ProofType;
  key: string;
  value: string;
  displayMarkup: string;
  sigID: SigID;
  mTime: Time;
}

export type RemoteProof = {
  proofType: ProofType;
  key: string;
  value: string;
  displayMarkup: string;
  sigID: SigID;
  mTime: Time;
}

export type identify_IdentifySource = 0 /* 'CLI_0' */ | 1 /* 'KBFS_1' */

export type IdentifySource = 0 /* 'CLI_0' */ | 1 /* 'KBFS_1' */

export type identify_Identify2Res = {
  upk: UserPlusKeys;
}

export type Identify2Res = {
  upk: UserPlusKeys;
}

export type identifyUi_Time = {
}

export type identifyUi_StringKVPair = {
  key: string;
  value: string;
}

export type identifyUi_Status = {
  code: int;
  name: string;
  desc: string;
  fields: Array<StringKVPair>;
}

export type identifyUi_UID = {
}

export type identifyUi_DeviceID = {
}

export type identifyUi_SigID = {
}

export type identifyUi_KID = {
}

export type identifyUi_Text = {
  data: string;
  markup: boolean;
}

export type identifyUi_PGPIdentity = {
  username: string;
  comment: string;
  email: string;
}

export type identifyUi_PublicKey = {
  KID: KID;
  PGPFingerprint: string;
  PGPIdentities: Array<PGPIdentity>;
  isSibkey: boolean;
  isEldest: boolean;
  parentID: string;
  deviceID: DeviceID;
  deviceDescription: string;
  deviceType: string;
  cTime: Time;
  eTime: Time;
}

export type identifyUi_User = {
  uid: UID;
  username: string;
}

export type identifyUi_Device = {
  type: string;
  name: string;
  deviceID: DeviceID;
  cTime: Time;
  mTime: Time;
}

export type identifyUi_Stream = {
  fd: int;
}

export type identifyUi_LogLevel = 0 /* 'NONE_0' */ | 1 /* 'DEBUG_1' */ | 2 /* 'INFO_2' */ | 3 /* 'NOTICE_3' */ | 4 /* 'WARN_4' */ | 5 /* 'ERROR_5' */ | 6 /* 'CRITICAL_6' */ | 7 /* 'FATAL_7' */

export type identifyUi_ClientType = 0 /* 'CLI_0' */ | 1 /* 'GUI_1' */

export type identifyUi_UserVersionVector = {
  id: long;
  sigHints: int;
  sigChain: long;
  cachedAt: Time;
  lastIdentifiedAt: Time;
}

export type identifyUi_UserPlusKeys = {
  uid: UID;
  username: string;
  deviceKeys: Array<PublicKey>;
  keys: Array<PublicKey>;
  uvv: UserVersionVector;
}

export type identifyUi_Asset = {
  name: string;
  url: string;
  localPath: string;
}

export type identifyUi_UpdateType = 0 /* 'NORMAL_0' */ | 1 /* 'BUGFIX_1' */ | 2 /* 'CRITICAL_2' */

export type identifyUi_Update = {
  version: string;
  name: string;
  description: string;
  type: UpdateType;
  asset: Asset;
}

export type identifyUi_ProofState = 0 /* 'NONE_0' */ | 1 /* 'OK_1' */ | 2 /* 'TEMP_FAILURE_2' */ | 3 /* 'PERM_FAILURE_3' */ | 4 /* 'LOOKING_4' */ | 5 /* 'SUPERSEDED_5' */ | 6 /* 'POSTED_6' */ | 7 /* 'REVOKED_7' */

export type identifyUi_ProofStatus = 0 /* 'NONE_0' */ | 1 /* 'OK_1' */ | 2 /* 'LOCAL_2' */ | 3 /* 'FOUND_3' */ | 4 /* 'BASE_ERROR_100' */ | 5 /* 'HOST_UNREACHABLE_101' */ | 6 /* 'PERMISSION_DENIED_103' */ | 7 /* 'FAILED_PARSE_106' */ | 8 /* 'DNS_ERROR_107' */ | 9 /* 'AUTH_FAILED_108' */ | 10 /* 'HTTP_500_150' */ | 11 /* 'TIMEOUT_160' */ | 12 /* 'INTERNAL_ERROR_170' */ | 13 /* 'BASE_HARD_ERROR_200' */ | 14 /* 'NOT_FOUND_201' */ | 15 /* 'CONTENT_FAILURE_202' */ | 16 /* 'BAD_USERNAME_203' */ | 17 /* 'BAD_REMOTE_ID_204' */ | 18 /* 'TEXT_NOT_FOUND_205' */ | 19 /* 'BAD_ARGS_206' */ | 20 /* 'CONTENT_MISSING_207' */ | 21 /* 'TITLE_NOT_FOUND_208' */ | 22 /* 'SERVICE_ERROR_209' */ | 23 /* 'TOR_SKIPPED_210' */ | 24 /* 'TOR_INCOMPATIBLE_211' */ | 25 /* 'HTTP_300_230' */ | 26 /* 'HTTP_400_240' */ | 27 /* 'HTTP_OTHER_260' */ | 28 /* 'EMPTY_JSON_270' */ | 29 /* 'DELETED_301' */ | 30 /* 'SERVICE_DEAD_302' */ | 31 /* 'BAD_SIGNATURE_303' */ | 32 /* 'BAD_API_URL_304' */ | 33 /* 'UNKNOWN_TYPE_305' */ | 34 /* 'NO_HINT_306' */ | 35 /* 'BAD_HINT_TEXT_307' */

export type identifyUi_ProofType = 0 /* 'NONE_0' */ | 1 /* 'KEYBASE_1' */ | 2 /* 'TWITTER_2' */ | 3 /* 'GITHUB_3' */ | 4 /* 'REDDIT_4' */ | 5 /* 'COINBASE_5' */ | 6 /* 'HACKERNEWS_6' */ | 7 /* 'GENERIC_WEB_SITE_1000' */ | 8 /* 'DNS_1001' */ | 9 /* 'ROOTER_100001' */

export type identifyUi_TrackToken = {
}

export type identifyUi_TrackDiffType = 0 /* 'NONE_0' */ | 1 /* 'ERROR_1' */ | 2 /* 'CLASH_2' */ | 3 /* 'REVOKED_3' */ | 4 /* 'UPGRADED_4' */ | 5 /* 'NEW_5' */ | 6 /* 'REMOTE_FAIL_6' */ | 7 /* 'REMOTE_WORKING_7' */ | 8 /* 'REMOTE_CHANGED_8' */ | 9 /* 'NEW_ELDEST_9' */

export type identifyUi_TrackDiff = {
  type: TrackDiffType;
  displayMarkup: string;
}

export type identifyUi_TrackSummary = {
  username: string;
  time: Time;
  isRemote: boolean;
}

export type identifyUi_TrackStatus = 0 /* 'NEW_OK_1' */ | 1 /* 'NEW_ZERO_PROOFS_2' */ | 2 /* 'NEW_FAIL_PROOFS_3' */ | 3 /* 'UPDATE_BROKEN_4' */ | 4 /* 'UPDATE_NEW_PROOFS_5' */ | 5 /* 'UPDATE_OK_6' */

export type identifyUi_TrackOptions = {
  localOnly: boolean;
  bypassConfirm: boolean;
}

export type identifyUi_IdentifyReason = {
  reason: string;
}

export type identifyUi_IdentifyOutcome = {
  username: string;
  status?: ?Status;
  warnings: Array<string>;
  trackUsed?: ?TrackSummary;
  trackStatus: TrackStatus;
  numTrackFailures: int;
  numTrackChanges: int;
  numProofFailures: int;
  numRevoked: int;
  numProofSuccesses: int;
  revoked: Array<TrackDiff>;
  trackOptions: TrackOptions;
  forPGPPull: boolean;
  reason: IdentifyReason;
}

export type identifyUi_IdentifyRes = {
  user?: ?User;
  publicKeys: Array<PublicKey>;
  outcome: IdentifyOutcome;
  trackToken: TrackToken;
}

export type identifyUi_RemoteProof = {
  proofType: ProofType;
  key: string;
  value: string;
  displayMarkup: string;
  sigID: SigID;
  mTime: Time;
}

export type identifyUi_ProofResult = {
  state: ProofState;
  status: ProofStatus;
  desc: string;
}

export type ProofResult = {
  state: ProofState;
  status: ProofStatus;
  desc: string;
}

export type identifyUi_IdentifyRow = {
  rowId: int;
  proof: RemoteProof;
  trackDiff?: ?TrackDiff;
}

export type IdentifyRow = {
  rowId: int;
  proof: RemoteProof;
  trackDiff?: ?TrackDiff;
}

export type identifyUi_IdentifyKey = {
  pgpFingerprint: bytes;
  KID: KID;
  trackDiff?: ?TrackDiff;
}

export type IdentifyKey = {
  pgpFingerprint: bytes;
  KID: KID;
  trackDiff?: ?TrackDiff;
}

export type identifyUi_Cryptocurrency = {
  rowId: int;
  pkhash: bytes;
  address: string;
}

export type Cryptocurrency = {
  rowId: int;
  pkhash: bytes;
  address: string;
}

export type identifyUi_Identity = {
  status?: ?Status;
  whenLastTracked: int;
  proofs: Array<IdentifyRow>;
  cryptocurrency: Array<Cryptocurrency>;
  revoked: Array<TrackDiff>;
}

export type Identity = {
  status?: ?Status;
  whenLastTracked: int;
  proofs: Array<IdentifyRow>;
  cryptocurrency: Array<Cryptocurrency>;
  revoked: Array<TrackDiff>;
}

export type identifyUi_SigHint = {
  remoteId: string;
  humanUrl: string;
  apiUrl: string;
  checkText: string;
}

export type SigHint = {
  remoteId: string;
  humanUrl: string;
  apiUrl: string;
  checkText: string;
}

export type identifyUi_CheckResult = {
  proofResult: ProofResult;
  time: Time;
  displayMarkup: string;
}

export type CheckResult = {
  proofResult: ProofResult;
  time: Time;
  displayMarkup: string;
}

export type identifyUi_LinkCheckResult = {
  proofId: int;
  proofResult: ProofResult;
  torWarning: boolean;
  cached?: ?CheckResult;
  diff?: ?TrackDiff;
  remoteDiff?: ?TrackDiff;
  hint?: ?SigHint;
}

export type LinkCheckResult = {
  proofId: int;
  proofResult: ProofResult;
  torWarning: boolean;
  cached?: ?CheckResult;
  diff?: ?TrackDiff;
  remoteDiff?: ?TrackDiff;
  hint?: ?SigHint;
}

export type identifyUi_UserCard = {
  following: int;
  followers: int;
  uid: UID;
  fullName: string;
  location: string;
  bio: string;
  website: string;
  twitter: string;
  youFollowThem: boolean;
  theyFollowYou: boolean;
}

export type UserCard = {
  following: int;
  followers: int;
  uid: UID;
  fullName: string;
  location: string;
  bio: string;
  website: string;
  twitter: string;
  youFollowThem: boolean;
  theyFollowYou: boolean;
}

export type identifyUi_ConfirmResult = {
  identityConfirmed: boolean;
  remoteConfirmed: boolean;
}

export type ConfirmResult = {
  identityConfirmed: boolean;
  remoteConfirmed: boolean;
}

export type install_Time = {
}

export type install_StringKVPair = {
  key: string;
  value: string;
}

export type install_Status = {
  code: int;
  name: string;
  desc: string;
  fields: Array<StringKVPair>;
}

export type install_UID = {
}

export type install_DeviceID = {
}

export type install_SigID = {
}

export type install_KID = {
}

export type install_Text = {
  data: string;
  markup: boolean;
}

export type install_PGPIdentity = {
  username: string;
  comment: string;
  email: string;
}

export type install_PublicKey = {
  KID: KID;
  PGPFingerprint: string;
  PGPIdentities: Array<PGPIdentity>;
  isSibkey: boolean;
  isEldest: boolean;
  parentID: string;
  deviceID: DeviceID;
  deviceDescription: string;
  deviceType: string;
  cTime: Time;
  eTime: Time;
}

export type install_User = {
  uid: UID;
  username: string;
}

export type install_Device = {
  type: string;
  name: string;
  deviceID: DeviceID;
  cTime: Time;
  mTime: Time;
}

export type install_Stream = {
  fd: int;
}

export type install_LogLevel = 0 /* 'NONE_0' */ | 1 /* 'DEBUG_1' */ | 2 /* 'INFO_2' */ | 3 /* 'NOTICE_3' */ | 4 /* 'WARN_4' */ | 5 /* 'ERROR_5' */ | 6 /* 'CRITICAL_6' */ | 7 /* 'FATAL_7' */

export type install_ClientType = 0 /* 'CLI_0' */ | 1 /* 'GUI_1' */

export type install_UserVersionVector = {
  id: long;
  sigHints: int;
  sigChain: long;
  cachedAt: Time;
  lastIdentifiedAt: Time;
}

export type install_UserPlusKeys = {
  uid: UID;
  username: string;
  deviceKeys: Array<PublicKey>;
  keys: Array<PublicKey>;
  uvv: UserVersionVector;
}

export type install_Asset = {
  name: string;
  url: string;
  localPath: string;
}

export type install_UpdateType = 0 /* 'NORMAL_0' */ | 1 /* 'BUGFIX_1' */ | 2 /* 'CRITICAL_2' */

export type install_Update = {
  version: string;
  name: string;
  description: string;
  type: UpdateType;
  asset: Asset;
}

export type install_InstallStatus = 0 /* 'UNKNOWN_0' */ | 1 /* 'ERROR_1' */ | 2 /* 'NOT_INSTALLED_2' */ | 3 /* 'INSTALLED_4' */

export type InstallStatus = 0 /* 'UNKNOWN_0' */ | 1 /* 'ERROR_1' */ | 2 /* 'NOT_INSTALLED_2' */ | 3 /* 'INSTALLED_4' */

export type install_InstallAction = 0 /* 'UNKNOWN_0' */ | 1 /* 'NONE_1' */ | 2 /* 'UPGRADE_2' */ | 3 /* 'REINSTALL_3' */ | 4 /* 'INSTALL_4' */

export type InstallAction = 0 /* 'UNKNOWN_0' */ | 1 /* 'NONE_1' */ | 2 /* 'UPGRADE_2' */ | 3 /* 'REINSTALL_3' */ | 4 /* 'INSTALL_4' */

export type install_ServiceStatus = {
  version: string;
  label: string;
  pid: string;
  lastExitStatus: string;
  bundleVersion: string;
  installStatus: InstallStatus;
  installAction: InstallAction;
  status: Status;
}

export type ServiceStatus = {
  version: string;
  label: string;
  pid: string;
  lastExitStatus: string;
  bundleVersion: string;
  installStatus: InstallStatus;
  installAction: InstallAction;
  status: Status;
}

export type install_ServicesStatus = {
  service: Array<ServiceStatus>;
  kbfs: Array<ServiceStatus>;
}

export type ServicesStatus = {
  service: Array<ServiceStatus>;
  kbfs: Array<ServiceStatus>;
}

export type install_FuseMountInfo = {
  path: string;
  fstype: string;
  output: string;
}

export type FuseMountInfo = {
  path: string;
  fstype: string;
  output: string;
}

export type install_FuseStatus = {
  version: string;
  bundleVersion: string;
  kextID: string;
  path: string;
  kextStarted: boolean;
  installStatus: InstallStatus;
  installAction: InstallAction;
  mountInfos: Array<FuseMountInfo>;
  status: Status;
}

export type FuseStatus = {
  version: string;
  bundleVersion: string;
  kextID: string;
  path: string;
  kextStarted: boolean;
  installStatus: InstallStatus;
  installAction: InstallAction;
  mountInfos: Array<FuseMountInfo>;
  status: Status;
}

export type install_ComponentStatus = {
  name: string;
  status: Status;
}

export type ComponentStatus = {
  name: string;
  status: Status;
}

export type kbfs_FSStatusCode = 0 /* 'START_0' */ | 1 /* 'FINISH_1' */ | 2 /* 'ERROR_2' */

export type FSStatusCode = 0 /* 'START_0' */ | 1 /* 'FINISH_1' */ | 2 /* 'ERROR_2' */

export type kbfs_FSNotificationType = 0 /* 'ENCRYPTING_0' */ | 1 /* 'DECRYPTING_1' */ | 2 /* 'SIGNING_2' */ | 3 /* 'VERIFYING_3' */ | 4 /* 'REKEYING_4' */

export type FSNotificationType = 0 /* 'ENCRYPTING_0' */ | 1 /* 'DECRYPTING_1' */ | 2 /* 'SIGNING_2' */ | 3 /* 'VERIFYING_3' */ | 4 /* 'REKEYING_4' */

export type kbfs_FSNotification = {
  publicTopLevelFolder: boolean;
  filename: string;
  status: string;
  statusCode: FSStatusCode;
  notificationType: FSNotificationType;
}

export type FSNotification = {
  publicTopLevelFolder: boolean;
  filename: string;
  status: string;
  statusCode: FSStatusCode;
  notificationType: FSNotificationType;
}

export type Kex2Provisionee_Time = {
}

export type Kex2Provisionee_StringKVPair = {
  key: string;
  value: string;
}

export type Kex2Provisionee_Status = {
  code: int;
  name: string;
  desc: string;
  fields: Array<StringKVPair>;
}

export type Kex2Provisionee_UID = {
}

export type Kex2Provisionee_DeviceID = {
}

export type Kex2Provisionee_SigID = {
}

export type Kex2Provisionee_KID = {
}

export type Kex2Provisionee_Text = {
  data: string;
  markup: boolean;
}

export type Kex2Provisionee_PGPIdentity = {
  username: string;
  comment: string;
  email: string;
}

export type Kex2Provisionee_PublicKey = {
  KID: KID;
  PGPFingerprint: string;
  PGPIdentities: Array<PGPIdentity>;
  isSibkey: boolean;
  isEldest: boolean;
  parentID: string;
  deviceID: DeviceID;
  deviceDescription: string;
  deviceType: string;
  cTime: Time;
  eTime: Time;
}

export type Kex2Provisionee_User = {
  uid: UID;
  username: string;
}

export type Kex2Provisionee_Device = {
  type: string;
  name: string;
  deviceID: DeviceID;
  cTime: Time;
  mTime: Time;
}

export type Kex2Provisionee_Stream = {
  fd: int;
}

export type Kex2Provisionee_LogLevel = 0 /* 'NONE_0' */ | 1 /* 'DEBUG_1' */ | 2 /* 'INFO_2' */ | 3 /* 'NOTICE_3' */ | 4 /* 'WARN_4' */ | 5 /* 'ERROR_5' */ | 6 /* 'CRITICAL_6' */ | 7 /* 'FATAL_7' */

export type Kex2Provisionee_ClientType = 0 /* 'CLI_0' */ | 1 /* 'GUI_1' */

export type Kex2Provisionee_UserVersionVector = {
  id: long;
  sigHints: int;
  sigChain: long;
  cachedAt: Time;
  lastIdentifiedAt: Time;
}

export type Kex2Provisionee_UserPlusKeys = {
  uid: UID;
  username: string;
  deviceKeys: Array<PublicKey>;
  keys: Array<PublicKey>;
  uvv: UserVersionVector;
}

export type Kex2Provisionee_Asset = {
  name: string;
  url: string;
  localPath: string;
}

export type Kex2Provisionee_UpdateType = 0 /* 'NORMAL_0' */ | 1 /* 'BUGFIX_1' */ | 2 /* 'CRITICAL_2' */

export type Kex2Provisionee_Update = {
  version: string;
  name: string;
  description: string;
  type: UpdateType;
  asset: Asset;
}

export type Kex2Provisionee_PassphraseStream = {
  passphraseStream: bytes;
  generation: int;
}

export type PassphraseStream = {
  passphraseStream: bytes;
  generation: int;
}

export type Kex2Provisionee_SessionToken = {
}

export type SessionToken = {
}

export type Kex2Provisionee_CsrfToken = {
}

export type CsrfToken = {
}

export type Kex2Provisionee_HelloRes = {
}

export type HelloRes = {
}

export type logUi_Time = {
}

export type logUi_StringKVPair = {
  key: string;
  value: string;
}

export type logUi_Status = {
  code: int;
  name: string;
  desc: string;
  fields: Array<StringKVPair>;
}

export type logUi_UID = {
}

export type logUi_DeviceID = {
}

export type logUi_SigID = {
}

export type logUi_KID = {
}

export type logUi_Text = {
  data: string;
  markup: boolean;
}

export type logUi_PGPIdentity = {
  username: string;
  comment: string;
  email: string;
}

export type logUi_PublicKey = {
  KID: KID;
  PGPFingerprint: string;
  PGPIdentities: Array<PGPIdentity>;
  isSibkey: boolean;
  isEldest: boolean;
  parentID: string;
  deviceID: DeviceID;
  deviceDescription: string;
  deviceType: string;
  cTime: Time;
  eTime: Time;
}

export type logUi_User = {
  uid: UID;
  username: string;
}

export type logUi_Device = {
  type: string;
  name: string;
  deviceID: DeviceID;
  cTime: Time;
  mTime: Time;
}

export type logUi_Stream = {
  fd: int;
}

export type logUi_LogLevel = 0 /* 'NONE_0' */ | 1 /* 'DEBUG_1' */ | 2 /* 'INFO_2' */ | 3 /* 'NOTICE_3' */ | 4 /* 'WARN_4' */ | 5 /* 'ERROR_5' */ | 6 /* 'CRITICAL_6' */ | 7 /* 'FATAL_7' */

export type logUi_ClientType = 0 /* 'CLI_0' */ | 1 /* 'GUI_1' */

export type logUi_UserVersionVector = {
  id: long;
  sigHints: int;
  sigChain: long;
  cachedAt: Time;
  lastIdentifiedAt: Time;
}

export type logUi_UserPlusKeys = {
  uid: UID;
  username: string;
  deviceKeys: Array<PublicKey>;
  keys: Array<PublicKey>;
  uvv: UserVersionVector;
}

export type logUi_Asset = {
  name: string;
  url: string;
  localPath: string;
}

export type logUi_UpdateType = 0 /* 'NORMAL_0' */ | 1 /* 'BUGFIX_1' */ | 2 /* 'CRITICAL_2' */

export type logUi_Update = {
  version: string;
  name: string;
  description: string;
  type: UpdateType;
  asset: Asset;
}

export type login_Time = {
}

export type login_StringKVPair = {
  key: string;
  value: string;
}

export type login_Status = {
  code: int;
  name: string;
  desc: string;
  fields: Array<StringKVPair>;
}

export type login_UID = {
}

export type login_DeviceID = {
}

export type login_SigID = {
}

export type login_KID = {
}

export type login_Text = {
  data: string;
  markup: boolean;
}

export type login_PGPIdentity = {
  username: string;
  comment: string;
  email: string;
}

export type login_PublicKey = {
  KID: KID;
  PGPFingerprint: string;
  PGPIdentities: Array<PGPIdentity>;
  isSibkey: boolean;
  isEldest: boolean;
  parentID: string;
  deviceID: DeviceID;
  deviceDescription: string;
  deviceType: string;
  cTime: Time;
  eTime: Time;
}

export type login_User = {
  uid: UID;
  username: string;
}

export type login_Device = {
  type: string;
  name: string;
  deviceID: DeviceID;
  cTime: Time;
  mTime: Time;
}

export type login_Stream = {
  fd: int;
}

export type login_LogLevel = 0 /* 'NONE_0' */ | 1 /* 'DEBUG_1' */ | 2 /* 'INFO_2' */ | 3 /* 'NOTICE_3' */ | 4 /* 'WARN_4' */ | 5 /* 'ERROR_5' */ | 6 /* 'CRITICAL_6' */ | 7 /* 'FATAL_7' */

export type login_ClientType = 0 /* 'CLI_0' */ | 1 /* 'GUI_1' */

export type login_UserVersionVector = {
  id: long;
  sigHints: int;
  sigChain: long;
  cachedAt: Time;
  lastIdentifiedAt: Time;
}

export type login_UserPlusKeys = {
  uid: UID;
  username: string;
  deviceKeys: Array<PublicKey>;
  keys: Array<PublicKey>;
  uvv: UserVersionVector;
}

export type login_Asset = {
  name: string;
  url: string;
  localPath: string;
}

export type login_UpdateType = 0 /* 'NORMAL_0' */ | 1 /* 'BUGFIX_1' */ | 2 /* 'CRITICAL_2' */

export type login_Update = {
  version: string;
  name: string;
  description: string;
  type: UpdateType;
  asset: Asset;
}

export type login_ConfiguredAccount = {
  username: string;
  hasStoredSecret: boolean;
}

export type ConfiguredAccount = {
  username: string;
  hasStoredSecret: boolean;
}

export type loginUi_Time = {
}

export type loginUi_StringKVPair = {
  key: string;
  value: string;
}

export type loginUi_Status = {
  code: int;
  name: string;
  desc: string;
  fields: Array<StringKVPair>;
}

export type loginUi_UID = {
}

export type loginUi_DeviceID = {
}

export type loginUi_SigID = {
}

export type loginUi_KID = {
}

export type loginUi_Text = {
  data: string;
  markup: boolean;
}

export type loginUi_PGPIdentity = {
  username: string;
  comment: string;
  email: string;
}

export type loginUi_PublicKey = {
  KID: KID;
  PGPFingerprint: string;
  PGPIdentities: Array<PGPIdentity>;
  isSibkey: boolean;
  isEldest: boolean;
  parentID: string;
  deviceID: DeviceID;
  deviceDescription: string;
  deviceType: string;
  cTime: Time;
  eTime: Time;
}

export type loginUi_User = {
  uid: UID;
  username: string;
}

export type loginUi_Device = {
  type: string;
  name: string;
  deviceID: DeviceID;
  cTime: Time;
  mTime: Time;
}

export type loginUi_Stream = {
  fd: int;
}

export type loginUi_LogLevel = 0 /* 'NONE_0' */ | 1 /* 'DEBUG_1' */ | 2 /* 'INFO_2' */ | 3 /* 'NOTICE_3' */ | 4 /* 'WARN_4' */ | 5 /* 'ERROR_5' */ | 6 /* 'CRITICAL_6' */ | 7 /* 'FATAL_7' */

export type loginUi_ClientType = 0 /* 'CLI_0' */ | 1 /* 'GUI_1' */

export type loginUi_UserVersionVector = {
  id: long;
  sigHints: int;
  sigChain: long;
  cachedAt: Time;
  lastIdentifiedAt: Time;
}

export type loginUi_UserPlusKeys = {
  uid: UID;
  username: string;
  deviceKeys: Array<PublicKey>;
  keys: Array<PublicKey>;
  uvv: UserVersionVector;
}

export type loginUi_Asset = {
  name: string;
  url: string;
  localPath: string;
}

export type loginUi_UpdateType = 0 /* 'NORMAL_0' */ | 1 /* 'BUGFIX_1' */ | 2 /* 'CRITICAL_2' */

export type loginUi_Update = {
  version: string;
  name: string;
  description: string;
  type: UpdateType;
  asset: Asset;
}

export type metadata_Time = {
}

export type metadata_StringKVPair = {
  key: string;
  value: string;
}

export type metadata_Status = {
  code: int;
  name: string;
  desc: string;
  fields: Array<StringKVPair>;
}

export type metadata_UID = {
}

export type metadata_DeviceID = {
}

export type metadata_SigID = {
}

export type metadata_KID = {
}

export type metadata_Text = {
  data: string;
  markup: boolean;
}

export type metadata_PGPIdentity = {
  username: string;
  comment: string;
  email: string;
}

export type metadata_PublicKey = {
  KID: KID;
  PGPFingerprint: string;
  PGPIdentities: Array<PGPIdentity>;
  isSibkey: boolean;
  isEldest: boolean;
  parentID: string;
  deviceID: DeviceID;
  deviceDescription: string;
  deviceType: string;
  cTime: Time;
  eTime: Time;
}

export type metadata_User = {
  uid: UID;
  username: string;
}

export type metadata_Device = {
  type: string;
  name: string;
  deviceID: DeviceID;
  cTime: Time;
  mTime: Time;
}

export type metadata_Stream = {
  fd: int;
}

export type metadata_LogLevel = 0 /* 'NONE_0' */ | 1 /* 'DEBUG_1' */ | 2 /* 'INFO_2' */ | 3 /* 'NOTICE_3' */ | 4 /* 'WARN_4' */ | 5 /* 'ERROR_5' */ | 6 /* 'CRITICAL_6' */ | 7 /* 'FATAL_7' */

export type metadata_ClientType = 0 /* 'CLI_0' */ | 1 /* 'GUI_1' */

export type metadata_UserVersionVector = {
  id: long;
  sigHints: int;
  sigChain: long;
  cachedAt: Time;
  lastIdentifiedAt: Time;
}

export type metadata_UserPlusKeys = {
  uid: UID;
  username: string;
  deviceKeys: Array<PublicKey>;
  keys: Array<PublicKey>;
  uvv: UserVersionVector;
}

export type metadata_Asset = {
  name: string;
  url: string;
  localPath: string;
}

export type metadata_UpdateType = 0 /* 'NORMAL_0' */ | 1 /* 'BUGFIX_1' */ | 2 /* 'CRITICAL_2' */

export type metadata_Update = {
  version: string;
  name: string;
  description: string;
  type: UpdateType;
  asset: Asset;
}

export type metadata_BlockIdCombo = {
  blockHash: string;
  chargedTo: UID;
}

export type metadata_KeyHalf = {
  user: UID;
  deviceKID: KID;
  key: bytes;
}

export type KeyHalf = {
  user: UID;
  deviceKID: KID;
  key: bytes;
}

export type metadata_MetadataResponse = {
  folderID: string;
  mdBlocks: Array<bytes>;
}

export type MetadataResponse = {
  folderID: string;
  mdBlocks: Array<bytes>;
}

export type metadataUpdate_Time = {
}

export type metadataUpdate_StringKVPair = {
  key: string;
  value: string;
}

export type metadataUpdate_Status = {
  code: int;
  name: string;
  desc: string;
  fields: Array<StringKVPair>;
}

export type metadataUpdate_UID = {
}

export type metadataUpdate_DeviceID = {
}

export type metadataUpdate_SigID = {
}

export type metadataUpdate_KID = {
}

export type metadataUpdate_Text = {
  data: string;
  markup: boolean;
}

export type metadataUpdate_PGPIdentity = {
  username: string;
  comment: string;
  email: string;
}

export type metadataUpdate_PublicKey = {
  KID: KID;
  PGPFingerprint: string;
  PGPIdentities: Array<PGPIdentity>;
  isSibkey: boolean;
  isEldest: boolean;
  parentID: string;
  deviceID: DeviceID;
  deviceDescription: string;
  deviceType: string;
  cTime: Time;
  eTime: Time;
}

export type metadataUpdate_User = {
  uid: UID;
  username: string;
}

export type metadataUpdate_Device = {
  type: string;
  name: string;
  deviceID: DeviceID;
  cTime: Time;
  mTime: Time;
}

export type metadataUpdate_Stream = {
  fd: int;
}

export type metadataUpdate_LogLevel = 0 /* 'NONE_0' */ | 1 /* 'DEBUG_1' */ | 2 /* 'INFO_2' */ | 3 /* 'NOTICE_3' */ | 4 /* 'WARN_4' */ | 5 /* 'ERROR_5' */ | 6 /* 'CRITICAL_6' */ | 7 /* 'FATAL_7' */

export type metadataUpdate_ClientType = 0 /* 'CLI_0' */ | 1 /* 'GUI_1' */

export type metadataUpdate_UserVersionVector = {
  id: long;
  sigHints: int;
  sigChain: long;
  cachedAt: Time;
  lastIdentifiedAt: Time;
}

export type metadataUpdate_UserPlusKeys = {
  uid: UID;
  username: string;
  deviceKeys: Array<PublicKey>;
  keys: Array<PublicKey>;
  uvv: UserVersionVector;
}

export type metadataUpdate_Asset = {
  name: string;
  url: string;
  localPath: string;
}

export type metadataUpdate_UpdateType = 0 /* 'NORMAL_0' */ | 1 /* 'BUGFIX_1' */ | 2 /* 'CRITICAL_2' */

export type metadataUpdate_Update = {
  version: string;
  name: string;
  description: string;
  type: UpdateType;
  asset: Asset;
}

export type metadataUpdate_BlockIdCombo = {
  blockHash: string;
  chargedTo: UID;
}

export type notifyCtl_Time = {
}

export type notifyCtl_StringKVPair = {
  key: string;
  value: string;
}

export type notifyCtl_Status = {
  code: int;
  name: string;
  desc: string;
  fields: Array<StringKVPair>;
}

export type notifyCtl_UID = {
}

export type notifyCtl_DeviceID = {
}

export type notifyCtl_SigID = {
}

export type notifyCtl_KID = {
}

export type notifyCtl_Text = {
  data: string;
  markup: boolean;
}

export type notifyCtl_PGPIdentity = {
  username: string;
  comment: string;
  email: string;
}

export type notifyCtl_PublicKey = {
  KID: KID;
  PGPFingerprint: string;
  PGPIdentities: Array<PGPIdentity>;
  isSibkey: boolean;
  isEldest: boolean;
  parentID: string;
  deviceID: DeviceID;
  deviceDescription: string;
  deviceType: string;
  cTime: Time;
  eTime: Time;
}

export type notifyCtl_User = {
  uid: UID;
  username: string;
}

export type notifyCtl_Device = {
  type: string;
  name: string;
  deviceID: DeviceID;
  cTime: Time;
  mTime: Time;
}

export type notifyCtl_Stream = {
  fd: int;
}

export type notifyCtl_LogLevel = 0 /* 'NONE_0' */ | 1 /* 'DEBUG_1' */ | 2 /* 'INFO_2' */ | 3 /* 'NOTICE_3' */ | 4 /* 'WARN_4' */ | 5 /* 'ERROR_5' */ | 6 /* 'CRITICAL_6' */ | 7 /* 'FATAL_7' */

export type notifyCtl_ClientType = 0 /* 'CLI_0' */ | 1 /* 'GUI_1' */

export type notifyCtl_UserVersionVector = {
  id: long;
  sigHints: int;
  sigChain: long;
  cachedAt: Time;
  lastIdentifiedAt: Time;
}

export type notifyCtl_UserPlusKeys = {
  uid: UID;
  username: string;
  deviceKeys: Array<PublicKey>;
  keys: Array<PublicKey>;
  uvv: UserVersionVector;
}

export type notifyCtl_Asset = {
  name: string;
  url: string;
  localPath: string;
}

export type notifyCtl_UpdateType = 0 /* 'NORMAL_0' */ | 1 /* 'BUGFIX_1' */ | 2 /* 'CRITICAL_2' */

export type notifyCtl_Update = {
  version: string;
  name: string;
  description: string;
  type: UpdateType;
  asset: Asset;
}

export type notifyCtl_NotificationChannels = {
  session: boolean;
  users: boolean;
  kbfs: boolean;
  tracking: boolean;
}

export type NotificationChannels = {
  session: boolean;
  users: boolean;
  kbfs: boolean;
  tracking: boolean;
}

export type NotifyFS_FSStatusCode = 0 /* 'START_0' */ | 1 /* 'FINISH_1' */ | 2 /* 'ERROR_2' */

export type NotifyFS_FSNotificationType = 0 /* 'ENCRYPTING_0' */ | 1 /* 'DECRYPTING_1' */ | 2 /* 'SIGNING_2' */ | 3 /* 'VERIFYING_3' */ | 4 /* 'REKEYING_4' */

export type NotifyFS_FSNotification = {
  publicTopLevelFolder: boolean;
  filename: string;
  status: string;
  statusCode: FSStatusCode;
  notificationType: FSNotificationType;
}

export type NotifyTracking_Time = {
}

export type NotifyTracking_StringKVPair = {
  key: string;
  value: string;
}

export type NotifyTracking_Status = {
  code: int;
  name: string;
  desc: string;
  fields: Array<StringKVPair>;
}

export type NotifyTracking_UID = {
}

export type NotifyTracking_DeviceID = {
}

export type NotifyTracking_SigID = {
}

export type NotifyTracking_KID = {
}

export type NotifyTracking_Text = {
  data: string;
  markup: boolean;
}

export type NotifyTracking_PGPIdentity = {
  username: string;
  comment: string;
  email: string;
}

export type NotifyTracking_PublicKey = {
  KID: KID;
  PGPFingerprint: string;
  PGPIdentities: Array<PGPIdentity>;
  isSibkey: boolean;
  isEldest: boolean;
  parentID: string;
  deviceID: DeviceID;
  deviceDescription: string;
  deviceType: string;
  cTime: Time;
  eTime: Time;
}

export type NotifyTracking_User = {
  uid: UID;
  username: string;
}

export type NotifyTracking_Device = {
  type: string;
  name: string;
  deviceID: DeviceID;
  cTime: Time;
  mTime: Time;
}

export type NotifyTracking_Stream = {
  fd: int;
}

export type NotifyTracking_LogLevel = 0 /* 'NONE_0' */ | 1 /* 'DEBUG_1' */ | 2 /* 'INFO_2' */ | 3 /* 'NOTICE_3' */ | 4 /* 'WARN_4' */ | 5 /* 'ERROR_5' */ | 6 /* 'CRITICAL_6' */ | 7 /* 'FATAL_7' */

export type NotifyTracking_ClientType = 0 /* 'CLI_0' */ | 1 /* 'GUI_1' */

export type NotifyTracking_UserVersionVector = {
  id: long;
  sigHints: int;
  sigChain: long;
  cachedAt: Time;
  lastIdentifiedAt: Time;
}

export type NotifyTracking_UserPlusKeys = {
  uid: UID;
  username: string;
  deviceKeys: Array<PublicKey>;
  keys: Array<PublicKey>;
  uvv: UserVersionVector;
}

export type NotifyTracking_Asset = {
  name: string;
  url: string;
  localPath: string;
}

export type NotifyTracking_UpdateType = 0 /* 'NORMAL_0' */ | 1 /* 'BUGFIX_1' */ | 2 /* 'CRITICAL_2' */

export type NotifyTracking_Update = {
  version: string;
  name: string;
  description: string;
  type: UpdateType;
  asset: Asset;
}

export type NotifyUsers_Time = {
}

export type NotifyUsers_StringKVPair = {
  key: string;
  value: string;
}

export type NotifyUsers_Status = {
  code: int;
  name: string;
  desc: string;
  fields: Array<StringKVPair>;
}

export type NotifyUsers_UID = {
}

export type NotifyUsers_DeviceID = {
}

export type NotifyUsers_SigID = {
}

export type NotifyUsers_KID = {
}

export type NotifyUsers_Text = {
  data: string;
  markup: boolean;
}

export type NotifyUsers_PGPIdentity = {
  username: string;
  comment: string;
  email: string;
}

export type NotifyUsers_PublicKey = {
  KID: KID;
  PGPFingerprint: string;
  PGPIdentities: Array<PGPIdentity>;
  isSibkey: boolean;
  isEldest: boolean;
  parentID: string;
  deviceID: DeviceID;
  deviceDescription: string;
  deviceType: string;
  cTime: Time;
  eTime: Time;
}

export type NotifyUsers_User = {
  uid: UID;
  username: string;
}

export type NotifyUsers_Device = {
  type: string;
  name: string;
  deviceID: DeviceID;
  cTime: Time;
  mTime: Time;
}

export type NotifyUsers_Stream = {
  fd: int;
}

export type NotifyUsers_LogLevel = 0 /* 'NONE_0' */ | 1 /* 'DEBUG_1' */ | 2 /* 'INFO_2' */ | 3 /* 'NOTICE_3' */ | 4 /* 'WARN_4' */ | 5 /* 'ERROR_5' */ | 6 /* 'CRITICAL_6' */ | 7 /* 'FATAL_7' */

export type NotifyUsers_ClientType = 0 /* 'CLI_0' */ | 1 /* 'GUI_1' */

export type NotifyUsers_UserVersionVector = {
  id: long;
  sigHints: int;
  sigChain: long;
  cachedAt: Time;
  lastIdentifiedAt: Time;
}

export type NotifyUsers_UserPlusKeys = {
  uid: UID;
  username: string;
  deviceKeys: Array<PublicKey>;
  keys: Array<PublicKey>;
  uvv: UserVersionVector;
}

export type NotifyUsers_Asset = {
  name: string;
  url: string;
  localPath: string;
}

export type NotifyUsers_UpdateType = 0 /* 'NORMAL_0' */ | 1 /* 'BUGFIX_1' */ | 2 /* 'CRITICAL_2' */

export type NotifyUsers_Update = {
  version: string;
  name: string;
  description: string;
  type: UpdateType;
  asset: Asset;
}

export type pgp_Time = {
}

export type pgp_StringKVPair = {
  key: string;
  value: string;
}

export type pgp_Status = {
  code: int;
  name: string;
  desc: string;
  fields: Array<StringKVPair>;
}

export type pgp_UID = {
}

export type pgp_DeviceID = {
}

export type pgp_SigID = {
}

export type pgp_KID = {
}

export type pgp_Text = {
  data: string;
  markup: boolean;
}

export type pgp_PGPIdentity = {
  username: string;
  comment: string;
  email: string;
}

export type pgp_PublicKey = {
  KID: KID;
  PGPFingerprint: string;
  PGPIdentities: Array<PGPIdentity>;
  isSibkey: boolean;
  isEldest: boolean;
  parentID: string;
  deviceID: DeviceID;
  deviceDescription: string;
  deviceType: string;
  cTime: Time;
  eTime: Time;
}

export type pgp_User = {
  uid: UID;
  username: string;
}

export type pgp_Device = {
  type: string;
  name: string;
  deviceID: DeviceID;
  cTime: Time;
  mTime: Time;
}

export type pgp_Stream = {
  fd: int;
}

export type pgp_LogLevel = 0 /* 'NONE_0' */ | 1 /* 'DEBUG_1' */ | 2 /* 'INFO_2' */ | 3 /* 'NOTICE_3' */ | 4 /* 'WARN_4' */ | 5 /* 'ERROR_5' */ | 6 /* 'CRITICAL_6' */ | 7 /* 'FATAL_7' */

export type pgp_ClientType = 0 /* 'CLI_0' */ | 1 /* 'GUI_1' */

export type pgp_UserVersionVector = {
  id: long;
  sigHints: int;
  sigChain: long;
  cachedAt: Time;
  lastIdentifiedAt: Time;
}

export type pgp_UserPlusKeys = {
  uid: UID;
  username: string;
  deviceKeys: Array<PublicKey>;
  keys: Array<PublicKey>;
  uvv: UserVersionVector;
}

export type pgp_Asset = {
  name: string;
  url: string;
  localPath: string;
}

export type pgp_UpdateType = 0 /* 'NORMAL_0' */ | 1 /* 'BUGFIX_1' */ | 2 /* 'CRITICAL_2' */

export type pgp_Update = {
  version: string;
  name: string;
  description: string;
  type: UpdateType;
  asset: Asset;
}

export type pgp_ProofState = 0 /* 'NONE_0' */ | 1 /* 'OK_1' */ | 2 /* 'TEMP_FAILURE_2' */ | 3 /* 'PERM_FAILURE_3' */ | 4 /* 'LOOKING_4' */ | 5 /* 'SUPERSEDED_5' */ | 6 /* 'POSTED_6' */ | 7 /* 'REVOKED_7' */

export type pgp_ProofStatus = 0 /* 'NONE_0' */ | 1 /* 'OK_1' */ | 2 /* 'LOCAL_2' */ | 3 /* 'FOUND_3' */ | 4 /* 'BASE_ERROR_100' */ | 5 /* 'HOST_UNREACHABLE_101' */ | 6 /* 'PERMISSION_DENIED_103' */ | 7 /* 'FAILED_PARSE_106' */ | 8 /* 'DNS_ERROR_107' */ | 9 /* 'AUTH_FAILED_108' */ | 10 /* 'HTTP_500_150' */ | 11 /* 'TIMEOUT_160' */ | 12 /* 'INTERNAL_ERROR_170' */ | 13 /* 'BASE_HARD_ERROR_200' */ | 14 /* 'NOT_FOUND_201' */ | 15 /* 'CONTENT_FAILURE_202' */ | 16 /* 'BAD_USERNAME_203' */ | 17 /* 'BAD_REMOTE_ID_204' */ | 18 /* 'TEXT_NOT_FOUND_205' */ | 19 /* 'BAD_ARGS_206' */ | 20 /* 'CONTENT_MISSING_207' */ | 21 /* 'TITLE_NOT_FOUND_208' */ | 22 /* 'SERVICE_ERROR_209' */ | 23 /* 'TOR_SKIPPED_210' */ | 24 /* 'TOR_INCOMPATIBLE_211' */ | 25 /* 'HTTP_300_230' */ | 26 /* 'HTTP_400_240' */ | 27 /* 'HTTP_OTHER_260' */ | 28 /* 'EMPTY_JSON_270' */ | 29 /* 'DELETED_301' */ | 30 /* 'SERVICE_DEAD_302' */ | 31 /* 'BAD_SIGNATURE_303' */ | 32 /* 'BAD_API_URL_304' */ | 33 /* 'UNKNOWN_TYPE_305' */ | 34 /* 'NO_HINT_306' */ | 35 /* 'BAD_HINT_TEXT_307' */

export type pgp_ProofType = 0 /* 'NONE_0' */ | 1 /* 'KEYBASE_1' */ | 2 /* 'TWITTER_2' */ | 3 /* 'GITHUB_3' */ | 4 /* 'REDDIT_4' */ | 5 /* 'COINBASE_5' */ | 6 /* 'HACKERNEWS_6' */ | 7 /* 'GENERIC_WEB_SITE_1000' */ | 8 /* 'DNS_1001' */ | 9 /* 'ROOTER_100001' */

export type pgp_TrackToken = {
}

export type pgp_TrackDiffType = 0 /* 'NONE_0' */ | 1 /* 'ERROR_1' */ | 2 /* 'CLASH_2' */ | 3 /* 'REVOKED_3' */ | 4 /* 'UPGRADED_4' */ | 5 /* 'NEW_5' */ | 6 /* 'REMOTE_FAIL_6' */ | 7 /* 'REMOTE_WORKING_7' */ | 8 /* 'REMOTE_CHANGED_8' */ | 9 /* 'NEW_ELDEST_9' */

export type pgp_TrackDiff = {
  type: TrackDiffType;
  displayMarkup: string;
}

export type pgp_TrackSummary = {
  username: string;
  time: Time;
  isRemote: boolean;
}

export type pgp_TrackStatus = 0 /* 'NEW_OK_1' */ | 1 /* 'NEW_ZERO_PROOFS_2' */ | 2 /* 'NEW_FAIL_PROOFS_3' */ | 3 /* 'UPDATE_BROKEN_4' */ | 4 /* 'UPDATE_NEW_PROOFS_5' */ | 5 /* 'UPDATE_OK_6' */

export type pgp_TrackOptions = {
  localOnly: boolean;
  bypassConfirm: boolean;
}

export type pgp_IdentifyReason = {
  reason: string;
}

export type pgp_IdentifyOutcome = {
  username: string;
  status?: ?Status;
  warnings: Array<string>;
  trackUsed?: ?TrackSummary;
  trackStatus: TrackStatus;
  numTrackFailures: int;
  numTrackChanges: int;
  numProofFailures: int;
  numRevoked: int;
  numProofSuccesses: int;
  revoked: Array<TrackDiff>;
  trackOptions: TrackOptions;
  forPGPPull: boolean;
  reason: IdentifyReason;
}

export type pgp_IdentifyRes = {
  user?: ?User;
  publicKeys: Array<PublicKey>;
  outcome: IdentifyOutcome;
  trackToken: TrackToken;
}

export type pgp_RemoteProof = {
  proofType: ProofType;
  key: string;
  value: string;
  displayMarkup: string;
  sigID: SigID;
  mTime: Time;
}

export type pgp_SignMode = 0 /* 'ATTACHED_0' */ | 1 /* 'DETACHED_1' */ | 2 /* 'CLEAR_2' */

export type SignMode = 0 /* 'ATTACHED_0' */ | 1 /* 'DETACHED_1' */ | 2 /* 'CLEAR_2' */

export type pgp_PGPSignOptions = {
  keyQuery: string;
  mode: SignMode;
  binaryIn: boolean;
  binaryOut: boolean;
}

export type PGPSignOptions = {
  keyQuery: string;
  mode: SignMode;
  binaryIn: boolean;
  binaryOut: boolean;
}

export type pgp_PGPEncryptOptions = {
  recipients: Array<string>;
  noSign: boolean;
  noSelf: boolean;
  binaryOut: boolean;
  keyQuery: string;
  skipTrack: boolean;
  trackOptions: TrackOptions;
}

export type PGPEncryptOptions = {
  recipients: Array<string>;
  noSign: boolean;
  noSelf: boolean;
  binaryOut: boolean;
  keyQuery: string;
  skipTrack: boolean;
  trackOptions: TrackOptions;
}

export type pgp_PGPSigVerification = {
  isSigned: boolean;
  verified: boolean;
  signer: User;
  signKey: PublicKey;
}

export type PGPSigVerification = {
  isSigned: boolean;
  verified: boolean;
  signer: User;
  signKey: PublicKey;
}

export type pgp_PGPDecryptOptions = {
  assertSigned: boolean;
  signedBy: string;
}

export type PGPDecryptOptions = {
  assertSigned: boolean;
  signedBy: string;
}

export type pgp_PGPVerifyOptions = {
  signedBy: string;
  signature: bytes;
}

export type PGPVerifyOptions = {
  signedBy: string;
  signature: bytes;
}

export type pgp_KeyInfo = {
  fingerprint: string;
  key: string;
  desc: string;
}

export type KeyInfo = {
  fingerprint: string;
  key: string;
  desc: string;
}

export type pgp_PGPQuery = {
  secret: boolean;
  query: string;
  exactMatch: boolean;
}

export type PGPQuery = {
  secret: boolean;
  query: string;
  exactMatch: boolean;
}

export type pgp_PGPCreateUids = {
  useDefault: boolean;
  ids: Array<PGPIdentity>;
}

export type PGPCreateUids = {
  useDefault: boolean;
  ids: Array<PGPIdentity>;
}

export type pgpUi_Time = {
}

export type pgpUi_StringKVPair = {
  key: string;
  value: string;
}

export type pgpUi_Status = {
  code: int;
  name: string;
  desc: string;
  fields: Array<StringKVPair>;
}

export type pgpUi_UID = {
}

export type pgpUi_DeviceID = {
}

export type pgpUi_SigID = {
}

export type pgpUi_KID = {
}

export type pgpUi_Text = {
  data: string;
  markup: boolean;
}

export type pgpUi_PGPIdentity = {
  username: string;
  comment: string;
  email: string;
}

export type pgpUi_PublicKey = {
  KID: KID;
  PGPFingerprint: string;
  PGPIdentities: Array<PGPIdentity>;
  isSibkey: boolean;
  isEldest: boolean;
  parentID: string;
  deviceID: DeviceID;
  deviceDescription: string;
  deviceType: string;
  cTime: Time;
  eTime: Time;
}

export type pgpUi_User = {
  uid: UID;
  username: string;
}

export type pgpUi_Device = {
  type: string;
  name: string;
  deviceID: DeviceID;
  cTime: Time;
  mTime: Time;
}

export type pgpUi_Stream = {
  fd: int;
}

export type pgpUi_LogLevel = 0 /* 'NONE_0' */ | 1 /* 'DEBUG_1' */ | 2 /* 'INFO_2' */ | 3 /* 'NOTICE_3' */ | 4 /* 'WARN_4' */ | 5 /* 'ERROR_5' */ | 6 /* 'CRITICAL_6' */ | 7 /* 'FATAL_7' */

export type pgpUi_ClientType = 0 /* 'CLI_0' */ | 1 /* 'GUI_1' */

export type pgpUi_UserVersionVector = {
  id: long;
  sigHints: int;
  sigChain: long;
  cachedAt: Time;
  lastIdentifiedAt: Time;
}

export type pgpUi_UserPlusKeys = {
  uid: UID;
  username: string;
  deviceKeys: Array<PublicKey>;
  keys: Array<PublicKey>;
  uvv: UserVersionVector;
}

export type pgpUi_Asset = {
  name: string;
  url: string;
  localPath: string;
}

export type pgpUi_UpdateType = 0 /* 'NORMAL_0' */ | 1 /* 'BUGFIX_1' */ | 2 /* 'CRITICAL_2' */

export type pgpUi_Update = {
  version: string;
  name: string;
  description: string;
  type: UpdateType;
  asset: Asset;
}

export type prove_Time = {
}

export type prove_StringKVPair = {
  key: string;
  value: string;
}

export type prove_Status = {
  code: int;
  name: string;
  desc: string;
  fields: Array<StringKVPair>;
}

export type prove_UID = {
}

export type prove_DeviceID = {
}

export type prove_SigID = {
}

export type prove_KID = {
}

export type prove_Text = {
  data: string;
  markup: boolean;
}

export type prove_PGPIdentity = {
  username: string;
  comment: string;
  email: string;
}

export type prove_PublicKey = {
  KID: KID;
  PGPFingerprint: string;
  PGPIdentities: Array<PGPIdentity>;
  isSibkey: boolean;
  isEldest: boolean;
  parentID: string;
  deviceID: DeviceID;
  deviceDescription: string;
  deviceType: string;
  cTime: Time;
  eTime: Time;
}

export type prove_User = {
  uid: UID;
  username: string;
}

export type prove_Device = {
  type: string;
  name: string;
  deviceID: DeviceID;
  cTime: Time;
  mTime: Time;
}

export type prove_Stream = {
  fd: int;
}

export type prove_LogLevel = 0 /* 'NONE_0' */ | 1 /* 'DEBUG_1' */ | 2 /* 'INFO_2' */ | 3 /* 'NOTICE_3' */ | 4 /* 'WARN_4' */ | 5 /* 'ERROR_5' */ | 6 /* 'CRITICAL_6' */ | 7 /* 'FATAL_7' */

export type prove_ClientType = 0 /* 'CLI_0' */ | 1 /* 'GUI_1' */

export type prove_UserVersionVector = {
  id: long;
  sigHints: int;
  sigChain: long;
  cachedAt: Time;
  lastIdentifiedAt: Time;
}

export type prove_UserPlusKeys = {
  uid: UID;
  username: string;
  deviceKeys: Array<PublicKey>;
  keys: Array<PublicKey>;
  uvv: UserVersionVector;
}

export type prove_Asset = {
  name: string;
  url: string;
  localPath: string;
}

export type prove_UpdateType = 0 /* 'NORMAL_0' */ | 1 /* 'BUGFIX_1' */ | 2 /* 'CRITICAL_2' */

export type prove_Update = {
  version: string;
  name: string;
  description: string;
  type: UpdateType;
  asset: Asset;
}

export type prove_ProofState = 0 /* 'NONE_0' */ | 1 /* 'OK_1' */ | 2 /* 'TEMP_FAILURE_2' */ | 3 /* 'PERM_FAILURE_3' */ | 4 /* 'LOOKING_4' */ | 5 /* 'SUPERSEDED_5' */ | 6 /* 'POSTED_6' */ | 7 /* 'REVOKED_7' */

export type prove_ProofStatus = 0 /* 'NONE_0' */ | 1 /* 'OK_1' */ | 2 /* 'LOCAL_2' */ | 3 /* 'FOUND_3' */ | 4 /* 'BASE_ERROR_100' */ | 5 /* 'HOST_UNREACHABLE_101' */ | 6 /* 'PERMISSION_DENIED_103' */ | 7 /* 'FAILED_PARSE_106' */ | 8 /* 'DNS_ERROR_107' */ | 9 /* 'AUTH_FAILED_108' */ | 10 /* 'HTTP_500_150' */ | 11 /* 'TIMEOUT_160' */ | 12 /* 'INTERNAL_ERROR_170' */ | 13 /* 'BASE_HARD_ERROR_200' */ | 14 /* 'NOT_FOUND_201' */ | 15 /* 'CONTENT_FAILURE_202' */ | 16 /* 'BAD_USERNAME_203' */ | 17 /* 'BAD_REMOTE_ID_204' */ | 18 /* 'TEXT_NOT_FOUND_205' */ | 19 /* 'BAD_ARGS_206' */ | 20 /* 'CONTENT_MISSING_207' */ | 21 /* 'TITLE_NOT_FOUND_208' */ | 22 /* 'SERVICE_ERROR_209' */ | 23 /* 'TOR_SKIPPED_210' */ | 24 /* 'TOR_INCOMPATIBLE_211' */ | 25 /* 'HTTP_300_230' */ | 26 /* 'HTTP_400_240' */ | 27 /* 'HTTP_OTHER_260' */ | 28 /* 'EMPTY_JSON_270' */ | 29 /* 'DELETED_301' */ | 30 /* 'SERVICE_DEAD_302' */ | 31 /* 'BAD_SIGNATURE_303' */ | 32 /* 'BAD_API_URL_304' */ | 33 /* 'UNKNOWN_TYPE_305' */ | 34 /* 'NO_HINT_306' */ | 35 /* 'BAD_HINT_TEXT_307' */

export type prove_ProofType = 0 /* 'NONE_0' */ | 1 /* 'KEYBASE_1' */ | 2 /* 'TWITTER_2' */ | 3 /* 'GITHUB_3' */ | 4 /* 'REDDIT_4' */ | 5 /* 'COINBASE_5' */ | 6 /* 'HACKERNEWS_6' */ | 7 /* 'GENERIC_WEB_SITE_1000' */ | 8 /* 'DNS_1001' */ | 9 /* 'ROOTER_100001' */

export type prove_TrackToken = {
}

export type prove_TrackDiffType = 0 /* 'NONE_0' */ | 1 /* 'ERROR_1' */ | 2 /* 'CLASH_2' */ | 3 /* 'REVOKED_3' */ | 4 /* 'UPGRADED_4' */ | 5 /* 'NEW_5' */ | 6 /* 'REMOTE_FAIL_6' */ | 7 /* 'REMOTE_WORKING_7' */ | 8 /* 'REMOTE_CHANGED_8' */ | 9 /* 'NEW_ELDEST_9' */

export type prove_TrackDiff = {
  type: TrackDiffType;
  displayMarkup: string;
}

export type prove_TrackSummary = {
  username: string;
  time: Time;
  isRemote: boolean;
}

export type prove_TrackStatus = 0 /* 'NEW_OK_1' */ | 1 /* 'NEW_ZERO_PROOFS_2' */ | 2 /* 'NEW_FAIL_PROOFS_3' */ | 3 /* 'UPDATE_BROKEN_4' */ | 4 /* 'UPDATE_NEW_PROOFS_5' */ | 5 /* 'UPDATE_OK_6' */

export type prove_TrackOptions = {
  localOnly: boolean;
  bypassConfirm: boolean;
}

export type prove_IdentifyReason = {
  reason: string;
}

export type prove_IdentifyOutcome = {
  username: string;
  status?: ?Status;
  warnings: Array<string>;
  trackUsed?: ?TrackSummary;
  trackStatus: TrackStatus;
  numTrackFailures: int;
  numTrackChanges: int;
  numProofFailures: int;
  numRevoked: int;
  numProofSuccesses: int;
  revoked: Array<TrackDiff>;
  trackOptions: TrackOptions;
  forPGPPull: boolean;
  reason: IdentifyReason;
}

export type prove_IdentifyRes = {
  user?: ?User;
  publicKeys: Array<PublicKey>;
  outcome: IdentifyOutcome;
  trackToken: TrackToken;
}

export type prove_RemoteProof = {
  proofType: ProofType;
  key: string;
  value: string;
  displayMarkup: string;
  sigID: SigID;
  mTime: Time;
}

export type prove_CheckProofStatus = {
  found: boolean;
  status: ProofStatus;
  proofText: string;
}

export type CheckProofStatus = {
  found: boolean;
  status: ProofStatus;
  proofText: string;
}

export type prove_StartProofResult = {
  sigID: SigID;
}

export type StartProofResult = {
  sigID: SigID;
}

export type proveUi_Time = {
}

export type proveUi_StringKVPair = {
  key: string;
  value: string;
}

export type proveUi_Status = {
  code: int;
  name: string;
  desc: string;
  fields: Array<StringKVPair>;
}

export type proveUi_UID = {
}

export type proveUi_DeviceID = {
}

export type proveUi_SigID = {
}

export type proveUi_KID = {
}

export type proveUi_Text = {
  data: string;
  markup: boolean;
}

export type proveUi_PGPIdentity = {
  username: string;
  comment: string;
  email: string;
}

export type proveUi_PublicKey = {
  KID: KID;
  PGPFingerprint: string;
  PGPIdentities: Array<PGPIdentity>;
  isSibkey: boolean;
  isEldest: boolean;
  parentID: string;
  deviceID: DeviceID;
  deviceDescription: string;
  deviceType: string;
  cTime: Time;
  eTime: Time;
}

export type proveUi_User = {
  uid: UID;
  username: string;
}

export type proveUi_Device = {
  type: string;
  name: string;
  deviceID: DeviceID;
  cTime: Time;
  mTime: Time;
}

export type proveUi_Stream = {
  fd: int;
}

export type proveUi_LogLevel = 0 /* 'NONE_0' */ | 1 /* 'DEBUG_1' */ | 2 /* 'INFO_2' */ | 3 /* 'NOTICE_3' */ | 4 /* 'WARN_4' */ | 5 /* 'ERROR_5' */ | 6 /* 'CRITICAL_6' */ | 7 /* 'FATAL_7' */

export type proveUi_ClientType = 0 /* 'CLI_0' */ | 1 /* 'GUI_1' */

export type proveUi_UserVersionVector = {
  id: long;
  sigHints: int;
  sigChain: long;
  cachedAt: Time;
  lastIdentifiedAt: Time;
}

export type proveUi_UserPlusKeys = {
  uid: UID;
  username: string;
  deviceKeys: Array<PublicKey>;
  keys: Array<PublicKey>;
  uvv: UserVersionVector;
}

export type proveUi_Asset = {
  name: string;
  url: string;
  localPath: string;
}

export type proveUi_UpdateType = 0 /* 'NORMAL_0' */ | 1 /* 'BUGFIX_1' */ | 2 /* 'CRITICAL_2' */

export type proveUi_Update = {
  version: string;
  name: string;
  description: string;
  type: UpdateType;
  asset: Asset;
}

export type proveUi_PromptOverwriteType = 0 /* 'SOCIAL_0' */ | 1 /* 'SITE_1' */

export type PromptOverwriteType = 0 /* 'SOCIAL_0' */ | 1 /* 'SITE_1' */

export type provisionUi_Time = {
}

export type provisionUi_StringKVPair = {
  key: string;
  value: string;
}

export type provisionUi_Status = {
  code: int;
  name: string;
  desc: string;
  fields: Array<StringKVPair>;
}

export type provisionUi_UID = {
}

export type provisionUi_DeviceID = {
}

export type provisionUi_SigID = {
}

export type provisionUi_KID = {
}

export type provisionUi_Text = {
  data: string;
  markup: boolean;
}

export type provisionUi_PGPIdentity = {
  username: string;
  comment: string;
  email: string;
}

export type provisionUi_PublicKey = {
  KID: KID;
  PGPFingerprint: string;
  PGPIdentities: Array<PGPIdentity>;
  isSibkey: boolean;
  isEldest: boolean;
  parentID: string;
  deviceID: DeviceID;
  deviceDescription: string;
  deviceType: string;
  cTime: Time;
  eTime: Time;
}

export type provisionUi_User = {
  uid: UID;
  username: string;
}

export type provisionUi_Device = {
  type: string;
  name: string;
  deviceID: DeviceID;
  cTime: Time;
  mTime: Time;
}

export type provisionUi_Stream = {
  fd: int;
}

export type provisionUi_LogLevel = 0 /* 'NONE_0' */ | 1 /* 'DEBUG_1' */ | 2 /* 'INFO_2' */ | 3 /* 'NOTICE_3' */ | 4 /* 'WARN_4' */ | 5 /* 'ERROR_5' */ | 6 /* 'CRITICAL_6' */ | 7 /* 'FATAL_7' */

export type provisionUi_ClientType = 0 /* 'CLI_0' */ | 1 /* 'GUI_1' */

export type provisionUi_UserVersionVector = {
  id: long;
  sigHints: int;
  sigChain: long;
  cachedAt: Time;
  lastIdentifiedAt: Time;
}

export type provisionUi_UserPlusKeys = {
  uid: UID;
  username: string;
  deviceKeys: Array<PublicKey>;
  keys: Array<PublicKey>;
  uvv: UserVersionVector;
}

export type provisionUi_Asset = {
  name: string;
  url: string;
  localPath: string;
}

export type provisionUi_UpdateType = 0 /* 'NORMAL_0' */ | 1 /* 'BUGFIX_1' */ | 2 /* 'CRITICAL_2' */

export type provisionUi_Update = {
  version: string;
  name: string;
  description: string;
  type: UpdateType;
  asset: Asset;
}

export type provisionUi_ProvisionMethod = 0 /* 'DEVICE_0' */ | 1 /* 'PAPER_KEY_1' */ | 2 /* 'PASSPHRASE_2' */ | 3 /* 'GPG_IMPORT_3' */ | 4 /* 'GPG_SIGN_4' */

export type ProvisionMethod = 0 /* 'DEVICE_0' */ | 1 /* 'PAPER_KEY_1' */ | 2 /* 'PASSPHRASE_2' */ | 3 /* 'GPG_IMPORT_3' */ | 4 /* 'GPG_SIGN_4' */

export type provisionUi_DeviceType = 0 /* 'DESKTOP_0' */ | 1 /* 'MOBILE_1' */

export type DeviceType = 0 /* 'DESKTOP_0' */ | 1 /* 'MOBILE_1' */

export type provisionUi_ChooseType = 0 /* 'EXISTING_DEVICE_0' */ | 1 /* 'NEW_DEVICE_1' */

export type ChooseType = 0 /* 'EXISTING_DEVICE_0' */ | 1 /* 'NEW_DEVICE_1' */

export type provisionUi_SecretResponse = {
  secret: bytes;
  phrase: string;
}

export type SecretResponse = {
  secret: bytes;
  phrase: string;
}

export type quota_Time = {
}

export type quota_StringKVPair = {
  key: string;
  value: string;
}

export type quota_Status = {
  code: int;
  name: string;
  desc: string;
  fields: Array<StringKVPair>;
}

export type quota_UID = {
}

export type quota_DeviceID = {
}

export type quota_SigID = {
}

export type quota_KID = {
}

export type quota_Text = {
  data: string;
  markup: boolean;
}

export type quota_PGPIdentity = {
  username: string;
  comment: string;
  email: string;
}

export type quota_PublicKey = {
  KID: KID;
  PGPFingerprint: string;
  PGPIdentities: Array<PGPIdentity>;
  isSibkey: boolean;
  isEldest: boolean;
  parentID: string;
  deviceID: DeviceID;
  deviceDescription: string;
  deviceType: string;
  cTime: Time;
  eTime: Time;
}

export type quota_User = {
  uid: UID;
  username: string;
}

export type quota_Device = {
  type: string;
  name: string;
  deviceID: DeviceID;
  cTime: Time;
  mTime: Time;
}

export type quota_Stream = {
  fd: int;
}

export type quota_LogLevel = 0 /* 'NONE_0' */ | 1 /* 'DEBUG_1' */ | 2 /* 'INFO_2' */ | 3 /* 'NOTICE_3' */ | 4 /* 'WARN_4' */ | 5 /* 'ERROR_5' */ | 6 /* 'CRITICAL_6' */ | 7 /* 'FATAL_7' */

export type quota_ClientType = 0 /* 'CLI_0' */ | 1 /* 'GUI_1' */

export type quota_UserVersionVector = {
  id: long;
  sigHints: int;
  sigChain: long;
  cachedAt: Time;
  lastIdentifiedAt: Time;
}

export type quota_UserPlusKeys = {
  uid: UID;
  username: string;
  deviceKeys: Array<PublicKey>;
  keys: Array<PublicKey>;
  uvv: UserVersionVector;
}

export type quota_Asset = {
  name: string;
  url: string;
  localPath: string;
}

export type quota_UpdateType = 0 /* 'NORMAL_0' */ | 1 /* 'BUGFIX_1' */ | 2 /* 'CRITICAL_2' */

export type quota_Update = {
  version: string;
  name: string;
  description: string;
  type: UpdateType;
  asset: Asset;
}

export type quota_VerifySessionRes = {
  uid: UID;
  sid: string;
  generated: int;
  lifetime: int;
}

export type VerifySessionRes = {
  uid: UID;
  sid: string;
  generated: int;
  lifetime: int;
}

export type revoke_Time = {
}

export type revoke_StringKVPair = {
  key: string;
  value: string;
}

export type revoke_Status = {
  code: int;
  name: string;
  desc: string;
  fields: Array<StringKVPair>;
}

export type revoke_UID = {
}

export type revoke_DeviceID = {
}

export type revoke_SigID = {
}

export type revoke_KID = {
}

export type revoke_Text = {
  data: string;
  markup: boolean;
}

export type revoke_PGPIdentity = {
  username: string;
  comment: string;
  email: string;
}

export type revoke_PublicKey = {
  KID: KID;
  PGPFingerprint: string;
  PGPIdentities: Array<PGPIdentity>;
  isSibkey: boolean;
  isEldest: boolean;
  parentID: string;
  deviceID: DeviceID;
  deviceDescription: string;
  deviceType: string;
  cTime: Time;
  eTime: Time;
}

export type revoke_User = {
  uid: UID;
  username: string;
}

export type revoke_Device = {
  type: string;
  name: string;
  deviceID: DeviceID;
  cTime: Time;
  mTime: Time;
}

export type revoke_Stream = {
  fd: int;
}

export type revoke_LogLevel = 0 /* 'NONE_0' */ | 1 /* 'DEBUG_1' */ | 2 /* 'INFO_2' */ | 3 /* 'NOTICE_3' */ | 4 /* 'WARN_4' */ | 5 /* 'ERROR_5' */ | 6 /* 'CRITICAL_6' */ | 7 /* 'FATAL_7' */

export type revoke_ClientType = 0 /* 'CLI_0' */ | 1 /* 'GUI_1' */

export type revoke_UserVersionVector = {
  id: long;
  sigHints: int;
  sigChain: long;
  cachedAt: Time;
  lastIdentifiedAt: Time;
}

export type revoke_UserPlusKeys = {
  uid: UID;
  username: string;
  deviceKeys: Array<PublicKey>;
  keys: Array<PublicKey>;
  uvv: UserVersionVector;
}

export type revoke_Asset = {
  name: string;
  url: string;
  localPath: string;
}

export type revoke_UpdateType = 0 /* 'NORMAL_0' */ | 1 /* 'BUGFIX_1' */ | 2 /* 'CRITICAL_2' */

export type revoke_Update = {
  version: string;
  name: string;
  description: string;
  type: UpdateType;
  asset: Asset;
}

export type saltPack_Time = {
}

export type saltPack_StringKVPair = {
  key: string;
  value: string;
}

export type saltPack_Status = {
  code: int;
  name: string;
  desc: string;
  fields: Array<StringKVPair>;
}

export type saltPack_UID = {
}

export type saltPack_DeviceID = {
}

export type saltPack_SigID = {
}

export type saltPack_KID = {
}

export type saltPack_Text = {
  data: string;
  markup: boolean;
}

export type saltPack_PGPIdentity = {
  username: string;
  comment: string;
  email: string;
}

export type saltPack_PublicKey = {
  KID: KID;
  PGPFingerprint: string;
  PGPIdentities: Array<PGPIdentity>;
  isSibkey: boolean;
  isEldest: boolean;
  parentID: string;
  deviceID: DeviceID;
  deviceDescription: string;
  deviceType: string;
  cTime: Time;
  eTime: Time;
}

export type saltPack_User = {
  uid: UID;
  username: string;
}

export type saltPack_Device = {
  type: string;
  name: string;
  deviceID: DeviceID;
  cTime: Time;
  mTime: Time;
}

export type saltPack_Stream = {
  fd: int;
}

export type saltPack_LogLevel = 0 /* 'NONE_0' */ | 1 /* 'DEBUG_1' */ | 2 /* 'INFO_2' */ | 3 /* 'NOTICE_3' */ | 4 /* 'WARN_4' */ | 5 /* 'ERROR_5' */ | 6 /* 'CRITICAL_6' */ | 7 /* 'FATAL_7' */

export type saltPack_ClientType = 0 /* 'CLI_0' */ | 1 /* 'GUI_1' */

export type saltPack_UserVersionVector = {
  id: long;
  sigHints: int;
  sigChain: long;
  cachedAt: Time;
  lastIdentifiedAt: Time;
}

export type saltPack_UserPlusKeys = {
  uid: UID;
  username: string;
  deviceKeys: Array<PublicKey>;
  keys: Array<PublicKey>;
  uvv: UserVersionVector;
}

export type saltPack_Asset = {
  name: string;
  url: string;
  localPath: string;
}

export type saltPack_UpdateType = 0 /* 'NORMAL_0' */ | 1 /* 'BUGFIX_1' */ | 2 /* 'CRITICAL_2' */

export type saltPack_Update = {
  version: string;
  name: string;
  description: string;
  type: UpdateType;
  asset: Asset;
}

export type saltPack_ProofState = 0 /* 'NONE_0' */ | 1 /* 'OK_1' */ | 2 /* 'TEMP_FAILURE_2' */ | 3 /* 'PERM_FAILURE_3' */ | 4 /* 'LOOKING_4' */ | 5 /* 'SUPERSEDED_5' */ | 6 /* 'POSTED_6' */ | 7 /* 'REVOKED_7' */

export type saltPack_ProofStatus = 0 /* 'NONE_0' */ | 1 /* 'OK_1' */ | 2 /* 'LOCAL_2' */ | 3 /* 'FOUND_3' */ | 4 /* 'BASE_ERROR_100' */ | 5 /* 'HOST_UNREACHABLE_101' */ | 6 /* 'PERMISSION_DENIED_103' */ | 7 /* 'FAILED_PARSE_106' */ | 8 /* 'DNS_ERROR_107' */ | 9 /* 'AUTH_FAILED_108' */ | 10 /* 'HTTP_500_150' */ | 11 /* 'TIMEOUT_160' */ | 12 /* 'INTERNAL_ERROR_170' */ | 13 /* 'BASE_HARD_ERROR_200' */ | 14 /* 'NOT_FOUND_201' */ | 15 /* 'CONTENT_FAILURE_202' */ | 16 /* 'BAD_USERNAME_203' */ | 17 /* 'BAD_REMOTE_ID_204' */ | 18 /* 'TEXT_NOT_FOUND_205' */ | 19 /* 'BAD_ARGS_206' */ | 20 /* 'CONTENT_MISSING_207' */ | 21 /* 'TITLE_NOT_FOUND_208' */ | 22 /* 'SERVICE_ERROR_209' */ | 23 /* 'TOR_SKIPPED_210' */ | 24 /* 'TOR_INCOMPATIBLE_211' */ | 25 /* 'HTTP_300_230' */ | 26 /* 'HTTP_400_240' */ | 27 /* 'HTTP_OTHER_260' */ | 28 /* 'EMPTY_JSON_270' */ | 29 /* 'DELETED_301' */ | 30 /* 'SERVICE_DEAD_302' */ | 31 /* 'BAD_SIGNATURE_303' */ | 32 /* 'BAD_API_URL_304' */ | 33 /* 'UNKNOWN_TYPE_305' */ | 34 /* 'NO_HINT_306' */ | 35 /* 'BAD_HINT_TEXT_307' */

export type saltPack_ProofType = 0 /* 'NONE_0' */ | 1 /* 'KEYBASE_1' */ | 2 /* 'TWITTER_2' */ | 3 /* 'GITHUB_3' */ | 4 /* 'REDDIT_4' */ | 5 /* 'COINBASE_5' */ | 6 /* 'HACKERNEWS_6' */ | 7 /* 'GENERIC_WEB_SITE_1000' */ | 8 /* 'DNS_1001' */ | 9 /* 'ROOTER_100001' */

export type saltPack_TrackToken = {
}

export type saltPack_TrackDiffType = 0 /* 'NONE_0' */ | 1 /* 'ERROR_1' */ | 2 /* 'CLASH_2' */ | 3 /* 'REVOKED_3' */ | 4 /* 'UPGRADED_4' */ | 5 /* 'NEW_5' */ | 6 /* 'REMOTE_FAIL_6' */ | 7 /* 'REMOTE_WORKING_7' */ | 8 /* 'REMOTE_CHANGED_8' */ | 9 /* 'NEW_ELDEST_9' */

export type saltPack_TrackDiff = {
  type: TrackDiffType;
  displayMarkup: string;
}

export type saltPack_TrackSummary = {
  username: string;
  time: Time;
  isRemote: boolean;
}

export type saltPack_TrackStatus = 0 /* 'NEW_OK_1' */ | 1 /* 'NEW_ZERO_PROOFS_2' */ | 2 /* 'NEW_FAIL_PROOFS_3' */ | 3 /* 'UPDATE_BROKEN_4' */ | 4 /* 'UPDATE_NEW_PROOFS_5' */ | 5 /* 'UPDATE_OK_6' */

export type saltPack_TrackOptions = {
  localOnly: boolean;
  bypassConfirm: boolean;
}

export type saltPack_IdentifyReason = {
  reason: string;
}

export type saltPack_IdentifyOutcome = {
  username: string;
  status?: ?Status;
  warnings: Array<string>;
  trackUsed?: ?TrackSummary;
  trackStatus: TrackStatus;
  numTrackFailures: int;
  numTrackChanges: int;
  numProofFailures: int;
  numRevoked: int;
  numProofSuccesses: int;
  revoked: Array<TrackDiff>;
  trackOptions: TrackOptions;
  forPGPPull: boolean;
  reason: IdentifyReason;
}

export type saltPack_IdentifyRes = {
  user?: ?User;
  publicKeys: Array<PublicKey>;
  outcome: IdentifyOutcome;
  trackToken: TrackToken;
}

export type saltPack_RemoteProof = {
  proofType: ProofType;
  key: string;
  value: string;
  displayMarkup: string;
  sigID: SigID;
  mTime: Time;
}

export type saltPack_SaltPackEncryptOptions = {
  recipients: Array<string>;
  trackOptions: TrackOptions;
}

export type SaltPackEncryptOptions = {
  recipients: Array<string>;
  trackOptions: TrackOptions;
}

export type secretUi_Feature = {
  allow: boolean;
  defaultValue: boolean;
  readonly: boolean;
  label: string;
}

export type secretUi_GUIEntryFeatures = {
  storeSecret: Feature;
  showTyping: Feature;
}

export type secretUi_GUIEntryArg = {
  windowTitle: string;
  prompt: string;
  submitLabel: string;
  cancelLabel: string;
  retryLabel: string;
  features: GUIEntryFeatures;
}

export type secretUi_GetPassphraseRes = {
  passphrase: string;
  storeSecret: boolean;
}

export type secretUi_SecretEntryArg = {
  desc: string;
  prompt: string;
  err: string;
  cancel: string;
  ok: string;
  reason: string;
  useSecretStore: boolean;
}

export type SecretEntryArg = {
  desc: string;
  prompt: string;
  err: string;
  cancel: string;
  ok: string;
  reason: string;
  useSecretStore: boolean;
}

export type secretUi_SecretEntryRes = {
  text: string;
  canceled: boolean;
  storeSecret: boolean;
}

export type SecretEntryRes = {
  text: string;
  canceled: boolean;
  storeSecret: boolean;
}

export type session_Time = {
}

export type session_StringKVPair = {
  key: string;
  value: string;
}

export type session_Status = {
  code: int;
  name: string;
  desc: string;
  fields: Array<StringKVPair>;
}

export type session_UID = {
}

export type session_DeviceID = {
}

export type session_SigID = {
}

export type session_KID = {
}

export type session_Text = {
  data: string;
  markup: boolean;
}

export type session_PGPIdentity = {
  username: string;
  comment: string;
  email: string;
}

export type session_PublicKey = {
  KID: KID;
  PGPFingerprint: string;
  PGPIdentities: Array<PGPIdentity>;
  isSibkey: boolean;
  isEldest: boolean;
  parentID: string;
  deviceID: DeviceID;
  deviceDescription: string;
  deviceType: string;
  cTime: Time;
  eTime: Time;
}

export type session_User = {
  uid: UID;
  username: string;
}

export type session_Device = {
  type: string;
  name: string;
  deviceID: DeviceID;
  cTime: Time;
  mTime: Time;
}

export type session_Stream = {
  fd: int;
}

export type session_LogLevel = 0 /* 'NONE_0' */ | 1 /* 'DEBUG_1' */ | 2 /* 'INFO_2' */ | 3 /* 'NOTICE_3' */ | 4 /* 'WARN_4' */ | 5 /* 'ERROR_5' */ | 6 /* 'CRITICAL_6' */ | 7 /* 'FATAL_7' */

export type session_ClientType = 0 /* 'CLI_0' */ | 1 /* 'GUI_1' */

export type session_UserVersionVector = {
  id: long;
  sigHints: int;
  sigChain: long;
  cachedAt: Time;
  lastIdentifiedAt: Time;
}

export type session_UserPlusKeys = {
  uid: UID;
  username: string;
  deviceKeys: Array<PublicKey>;
  keys: Array<PublicKey>;
  uvv: UserVersionVector;
}

export type session_Asset = {
  name: string;
  url: string;
  localPath: string;
}

export type session_UpdateType = 0 /* 'NORMAL_0' */ | 1 /* 'BUGFIX_1' */ | 2 /* 'CRITICAL_2' */

export type session_Update = {
  version: string;
  name: string;
  description: string;
  type: UpdateType;
  asset: Asset;
}

export type session_Session = {
  uid: UID;
  username: string;
  token: string;
  deviceSubkeyKid: KID;
  deviceSibkeyKid: KID;
}

export type Session = {
  uid: UID;
  username: string;
  token: string;
  deviceSubkeyKid: KID;
  deviceSibkeyKid: KID;
}

export type signup_Time = {
}

export type signup_StringKVPair = {
  key: string;
  value: string;
}

export type signup_Status = {
  code: int;
  name: string;
  desc: string;
  fields: Array<StringKVPair>;
}

export type signup_UID = {
}

export type signup_DeviceID = {
}

export type signup_SigID = {
}

export type signup_KID = {
}

export type signup_Text = {
  data: string;
  markup: boolean;
}

export type signup_PGPIdentity = {
  username: string;
  comment: string;
  email: string;
}

export type signup_PublicKey = {
  KID: KID;
  PGPFingerprint: string;
  PGPIdentities: Array<PGPIdentity>;
  isSibkey: boolean;
  isEldest: boolean;
  parentID: string;
  deviceID: DeviceID;
  deviceDescription: string;
  deviceType: string;
  cTime: Time;
  eTime: Time;
}

export type signup_User = {
  uid: UID;
  username: string;
}

export type signup_Device = {
  type: string;
  name: string;
  deviceID: DeviceID;
  cTime: Time;
  mTime: Time;
}

export type signup_Stream = {
  fd: int;
}

export type signup_LogLevel = 0 /* 'NONE_0' */ | 1 /* 'DEBUG_1' */ | 2 /* 'INFO_2' */ | 3 /* 'NOTICE_3' */ | 4 /* 'WARN_4' */ | 5 /* 'ERROR_5' */ | 6 /* 'CRITICAL_6' */ | 7 /* 'FATAL_7' */

export type signup_ClientType = 0 /* 'CLI_0' */ | 1 /* 'GUI_1' */

export type signup_UserVersionVector = {
  id: long;
  sigHints: int;
  sigChain: long;
  cachedAt: Time;
  lastIdentifiedAt: Time;
}

export type signup_UserPlusKeys = {
  uid: UID;
  username: string;
  deviceKeys: Array<PublicKey>;
  keys: Array<PublicKey>;
  uvv: UserVersionVector;
}

export type signup_Asset = {
  name: string;
  url: string;
  localPath: string;
}

export type signup_UpdateType = 0 /* 'NORMAL_0' */ | 1 /* 'BUGFIX_1' */ | 2 /* 'CRITICAL_2' */

export type signup_Update = {
  version: string;
  name: string;
  description: string;
  type: UpdateType;
  asset: Asset;
}

export type signup_SignupRes = {
  passphraseOk: boolean;
  postOk: boolean;
  writeOk: boolean;
}

export type SignupRes = {
  passphraseOk: boolean;
  postOk: boolean;
  writeOk: boolean;
}

export type sigs_Time = {
}

export type sigs_StringKVPair = {
  key: string;
  value: string;
}

export type sigs_Status = {
  code: int;
  name: string;
  desc: string;
  fields: Array<StringKVPair>;
}

export type sigs_UID = {
}

export type sigs_DeviceID = {
}

export type sigs_SigID = {
}

export type sigs_KID = {
}

export type sigs_Text = {
  data: string;
  markup: boolean;
}

export type sigs_PGPIdentity = {
  username: string;
  comment: string;
  email: string;
}

export type sigs_PublicKey = {
  KID: KID;
  PGPFingerprint: string;
  PGPIdentities: Array<PGPIdentity>;
  isSibkey: boolean;
  isEldest: boolean;
  parentID: string;
  deviceID: DeviceID;
  deviceDescription: string;
  deviceType: string;
  cTime: Time;
  eTime: Time;
}

export type sigs_User = {
  uid: UID;
  username: string;
}

export type sigs_Device = {
  type: string;
  name: string;
  deviceID: DeviceID;
  cTime: Time;
  mTime: Time;
}

export type sigs_Stream = {
  fd: int;
}

export type sigs_LogLevel = 0 /* 'NONE_0' */ | 1 /* 'DEBUG_1' */ | 2 /* 'INFO_2' */ | 3 /* 'NOTICE_3' */ | 4 /* 'WARN_4' */ | 5 /* 'ERROR_5' */ | 6 /* 'CRITICAL_6' */ | 7 /* 'FATAL_7' */

export type sigs_ClientType = 0 /* 'CLI_0' */ | 1 /* 'GUI_1' */

export type sigs_UserVersionVector = {
  id: long;
  sigHints: int;
  sigChain: long;
  cachedAt: Time;
  lastIdentifiedAt: Time;
}

export type sigs_UserPlusKeys = {
  uid: UID;
  username: string;
  deviceKeys: Array<PublicKey>;
  keys: Array<PublicKey>;
  uvv: UserVersionVector;
}

export type sigs_Asset = {
  name: string;
  url: string;
  localPath: string;
}

export type sigs_UpdateType = 0 /* 'NORMAL_0' */ | 1 /* 'BUGFIX_1' */ | 2 /* 'CRITICAL_2' */

export type sigs_Update = {
  version: string;
  name: string;
  description: string;
  type: UpdateType;
  asset: Asset;
}

export type sigs_Sig = {
  seqno: int;
  sigID: SigID;
  sigIDDisplay: string;
  type: string;
  cTime: Time;
  revoked: boolean;
  active: boolean;
  key: string;
  body: string;
}

export type Sig = {
  seqno: int;
  sigID: SigID;
  sigIDDisplay: string;
  type: string;
  cTime: Time;
  revoked: boolean;
  active: boolean;
  key: string;
  body: string;
}

export type sigs_SigTypes = {
  track: boolean;
  proof: boolean;
  cryptocurrency: boolean;
  isSelf: boolean;
}

export type SigTypes = {
  track: boolean;
  proof: boolean;
  cryptocurrency: boolean;
  isSelf: boolean;
}

export type sigs_SigListArgs = {
  sessionID: int;
  username: string;
  allKeys: boolean;
  types?: ?SigTypes;
  filterx: string;
  verbose: boolean;
  revoked: boolean;
}

export type SigListArgs = {
  sessionID: int;
  username: string;
  allKeys: boolean;
  types?: ?SigTypes;
  filterx: string;
  verbose: boolean;
  revoked: boolean;
}

export type streamUi_Time = {
}

export type streamUi_StringKVPair = {
  key: string;
  value: string;
}

export type streamUi_Status = {
  code: int;
  name: string;
  desc: string;
  fields: Array<StringKVPair>;
}

export type streamUi_UID = {
}

export type streamUi_DeviceID = {
}

export type streamUi_SigID = {
}

export type streamUi_KID = {
}

export type streamUi_Text = {
  data: string;
  markup: boolean;
}

export type streamUi_PGPIdentity = {
  username: string;
  comment: string;
  email: string;
}

export type streamUi_PublicKey = {
  KID: KID;
  PGPFingerprint: string;
  PGPIdentities: Array<PGPIdentity>;
  isSibkey: boolean;
  isEldest: boolean;
  parentID: string;
  deviceID: DeviceID;
  deviceDescription: string;
  deviceType: string;
  cTime: Time;
  eTime: Time;
}

export type streamUi_User = {
  uid: UID;
  username: string;
}

export type streamUi_Device = {
  type: string;
  name: string;
  deviceID: DeviceID;
  cTime: Time;
  mTime: Time;
}

export type streamUi_Stream = {
  fd: int;
}

export type streamUi_LogLevel = 0 /* 'NONE_0' */ | 1 /* 'DEBUG_1' */ | 2 /* 'INFO_2' */ | 3 /* 'NOTICE_3' */ | 4 /* 'WARN_4' */ | 5 /* 'ERROR_5' */ | 6 /* 'CRITICAL_6' */ | 7 /* 'FATAL_7' */

export type streamUi_ClientType = 0 /* 'CLI_0' */ | 1 /* 'GUI_1' */

export type streamUi_UserVersionVector = {
  id: long;
  sigHints: int;
  sigChain: long;
  cachedAt: Time;
  lastIdentifiedAt: Time;
}

export type streamUi_UserPlusKeys = {
  uid: UID;
  username: string;
  deviceKeys: Array<PublicKey>;
  keys: Array<PublicKey>;
  uvv: UserVersionVector;
}

export type streamUi_Asset = {
  name: string;
  url: string;
  localPath: string;
}

export type streamUi_UpdateType = 0 /* 'NORMAL_0' */ | 1 /* 'BUGFIX_1' */ | 2 /* 'CRITICAL_2' */

export type streamUi_Update = {
  version: string;
  name: string;
  description: string;
  type: UpdateType;
  asset: Asset;
}

export type test_Test = {
  reply: string;
}

export type Test = {
  reply: string;
}

export type track_Time = {
}

export type track_StringKVPair = {
  key: string;
  value: string;
}

export type track_Status = {
  code: int;
  name: string;
  desc: string;
  fields: Array<StringKVPair>;
}

export type track_UID = {
}

export type track_DeviceID = {
}

export type track_SigID = {
}

export type track_KID = {
}

export type track_Text = {
  data: string;
  markup: boolean;
}

export type track_PGPIdentity = {
  username: string;
  comment: string;
  email: string;
}

export type track_PublicKey = {
  KID: KID;
  PGPFingerprint: string;
  PGPIdentities: Array<PGPIdentity>;
  isSibkey: boolean;
  isEldest: boolean;
  parentID: string;
  deviceID: DeviceID;
  deviceDescription: string;
  deviceType: string;
  cTime: Time;
  eTime: Time;
}

export type track_User = {
  uid: UID;
  username: string;
}

export type track_Device = {
  type: string;
  name: string;
  deviceID: DeviceID;
  cTime: Time;
  mTime: Time;
}

export type track_Stream = {
  fd: int;
}

export type track_LogLevel = 0 /* 'NONE_0' */ | 1 /* 'DEBUG_1' */ | 2 /* 'INFO_2' */ | 3 /* 'NOTICE_3' */ | 4 /* 'WARN_4' */ | 5 /* 'ERROR_5' */ | 6 /* 'CRITICAL_6' */ | 7 /* 'FATAL_7' */

export type track_ClientType = 0 /* 'CLI_0' */ | 1 /* 'GUI_1' */

export type track_UserVersionVector = {
  id: long;
  sigHints: int;
  sigChain: long;
  cachedAt: Time;
  lastIdentifiedAt: Time;
}

export type track_UserPlusKeys = {
  uid: UID;
  username: string;
  deviceKeys: Array<PublicKey>;
  keys: Array<PublicKey>;
  uvv: UserVersionVector;
}

export type track_Asset = {
  name: string;
  url: string;
  localPath: string;
}

export type track_UpdateType = 0 /* 'NORMAL_0' */ | 1 /* 'BUGFIX_1' */ | 2 /* 'CRITICAL_2' */

export type track_Update = {
  version: string;
  name: string;
  description: string;
  type: UpdateType;
  asset: Asset;
}

export type track_ProofState = 0 /* 'NONE_0' */ | 1 /* 'OK_1' */ | 2 /* 'TEMP_FAILURE_2' */ | 3 /* 'PERM_FAILURE_3' */ | 4 /* 'LOOKING_4' */ | 5 /* 'SUPERSEDED_5' */ | 6 /* 'POSTED_6' */ | 7 /* 'REVOKED_7' */

export type track_ProofStatus = 0 /* 'NONE_0' */ | 1 /* 'OK_1' */ | 2 /* 'LOCAL_2' */ | 3 /* 'FOUND_3' */ | 4 /* 'BASE_ERROR_100' */ | 5 /* 'HOST_UNREACHABLE_101' */ | 6 /* 'PERMISSION_DENIED_103' */ | 7 /* 'FAILED_PARSE_106' */ | 8 /* 'DNS_ERROR_107' */ | 9 /* 'AUTH_FAILED_108' */ | 10 /* 'HTTP_500_150' */ | 11 /* 'TIMEOUT_160' */ | 12 /* 'INTERNAL_ERROR_170' */ | 13 /* 'BASE_HARD_ERROR_200' */ | 14 /* 'NOT_FOUND_201' */ | 15 /* 'CONTENT_FAILURE_202' */ | 16 /* 'BAD_USERNAME_203' */ | 17 /* 'BAD_REMOTE_ID_204' */ | 18 /* 'TEXT_NOT_FOUND_205' */ | 19 /* 'BAD_ARGS_206' */ | 20 /* 'CONTENT_MISSING_207' */ | 21 /* 'TITLE_NOT_FOUND_208' */ | 22 /* 'SERVICE_ERROR_209' */ | 23 /* 'TOR_SKIPPED_210' */ | 24 /* 'TOR_INCOMPATIBLE_211' */ | 25 /* 'HTTP_300_230' */ | 26 /* 'HTTP_400_240' */ | 27 /* 'HTTP_OTHER_260' */ | 28 /* 'EMPTY_JSON_270' */ | 29 /* 'DELETED_301' */ | 30 /* 'SERVICE_DEAD_302' */ | 31 /* 'BAD_SIGNATURE_303' */ | 32 /* 'BAD_API_URL_304' */ | 33 /* 'UNKNOWN_TYPE_305' */ | 34 /* 'NO_HINT_306' */ | 35 /* 'BAD_HINT_TEXT_307' */

export type track_ProofType = 0 /* 'NONE_0' */ | 1 /* 'KEYBASE_1' */ | 2 /* 'TWITTER_2' */ | 3 /* 'GITHUB_3' */ | 4 /* 'REDDIT_4' */ | 5 /* 'COINBASE_5' */ | 6 /* 'HACKERNEWS_6' */ | 7 /* 'GENERIC_WEB_SITE_1000' */ | 8 /* 'DNS_1001' */ | 9 /* 'ROOTER_100001' */

export type track_TrackToken = {
}

export type track_TrackDiffType = 0 /* 'NONE_0' */ | 1 /* 'ERROR_1' */ | 2 /* 'CLASH_2' */ | 3 /* 'REVOKED_3' */ | 4 /* 'UPGRADED_4' */ | 5 /* 'NEW_5' */ | 6 /* 'REMOTE_FAIL_6' */ | 7 /* 'REMOTE_WORKING_7' */ | 8 /* 'REMOTE_CHANGED_8' */ | 9 /* 'NEW_ELDEST_9' */

export type track_TrackDiff = {
  type: TrackDiffType;
  displayMarkup: string;
}

export type track_TrackSummary = {
  username: string;
  time: Time;
  isRemote: boolean;
}

export type track_TrackStatus = 0 /* 'NEW_OK_1' */ | 1 /* 'NEW_ZERO_PROOFS_2' */ | 2 /* 'NEW_FAIL_PROOFS_3' */ | 3 /* 'UPDATE_BROKEN_4' */ | 4 /* 'UPDATE_NEW_PROOFS_5' */ | 5 /* 'UPDATE_OK_6' */

export type track_TrackOptions = {
  localOnly: boolean;
  bypassConfirm: boolean;
}

export type track_IdentifyReason = {
  reason: string;
}

export type track_IdentifyOutcome = {
  username: string;
  status?: ?Status;
  warnings: Array<string>;
  trackUsed?: ?TrackSummary;
  trackStatus: TrackStatus;
  numTrackFailures: int;
  numTrackChanges: int;
  numProofFailures: int;
  numRevoked: int;
  numProofSuccesses: int;
  revoked: Array<TrackDiff>;
  trackOptions: TrackOptions;
  forPGPPull: boolean;
  reason: IdentifyReason;
}

export type track_IdentifyRes = {
  user?: ?User;
  publicKeys: Array<PublicKey>;
  outcome: IdentifyOutcome;
  trackToken: TrackToken;
}

export type track_RemoteProof = {
  proofType: ProofType;
  key: string;
  value: string;
  displayMarkup: string;
  sigID: SigID;
  mTime: Time;
}

export type ui_Time = {
}

export type ui_StringKVPair = {
  key: string;
  value: string;
}

export type ui_Status = {
  code: int;
  name: string;
  desc: string;
  fields: Array<StringKVPair>;
}

export type ui_UID = {
}

export type ui_DeviceID = {
}

export type ui_SigID = {
}

export type ui_KID = {
}

export type ui_Text = {
  data: string;
  markup: boolean;
}

export type ui_PGPIdentity = {
  username: string;
  comment: string;
  email: string;
}

export type ui_PublicKey = {
  KID: KID;
  PGPFingerprint: string;
  PGPIdentities: Array<PGPIdentity>;
  isSibkey: boolean;
  isEldest: boolean;
  parentID: string;
  deviceID: DeviceID;
  deviceDescription: string;
  deviceType: string;
  cTime: Time;
  eTime: Time;
}

export type ui_User = {
  uid: UID;
  username: string;
}

export type ui_Device = {
  type: string;
  name: string;
  deviceID: DeviceID;
  cTime: Time;
  mTime: Time;
}

export type ui_Stream = {
  fd: int;
}

export type ui_LogLevel = 0 /* 'NONE_0' */ | 1 /* 'DEBUG_1' */ | 2 /* 'INFO_2' */ | 3 /* 'NOTICE_3' */ | 4 /* 'WARN_4' */ | 5 /* 'ERROR_5' */ | 6 /* 'CRITICAL_6' */ | 7 /* 'FATAL_7' */

export type ui_ClientType = 0 /* 'CLI_0' */ | 1 /* 'GUI_1' */

export type ui_UserVersionVector = {
  id: long;
  sigHints: int;
  sigChain: long;
  cachedAt: Time;
  lastIdentifiedAt: Time;
}

export type ui_UserPlusKeys = {
  uid: UID;
  username: string;
  deviceKeys: Array<PublicKey>;
  keys: Array<PublicKey>;
  uvv: UserVersionVector;
}

export type ui_Asset = {
  name: string;
  url: string;
  localPath: string;
}

export type ui_UpdateType = 0 /* 'NORMAL_0' */ | 1 /* 'BUGFIX_1' */ | 2 /* 'CRITICAL_2' */

export type ui_Update = {
  version: string;
  name: string;
  description: string;
  type: UpdateType;
  asset: Asset;
}

export type ui_PromptDefault = 0 /* 'NONE_0' */ | 1 /* 'YES_1' */ | 2 /* 'NO_2' */

export type PromptDefault = 0 /* 'NONE_0' */ | 1 /* 'YES_1' */ | 2 /* 'NO_2' */

export type update_Asset = {
  name: string;
  url: string;
  localPath: string;
}

export type update_UpdateType = 0 /* 'NORMAL_0' */ | 1 /* 'BUGFIX_1' */ | 2 /* 'CRITICAL_2' */

export type update_Update = {
  version: string;
  name: string;
  description: string;
  type: UpdateType;
  asset: Asset;
}

export type update_UpdateConfig = {
  version: string;
  platform: string;
  destinationPath: string;
  source: string;
  URL: string;
  channel: string;
  force: boolean;
}

export type UpdateConfig = {
  version: string;
  platform: string;
  destinationPath: string;
  source: string;
  URL: string;
  channel: string;
  force: boolean;
}

export type update_UpdateResult = {
  update?: ?Update;
}

export type UpdateResult = {
  update?: ?Update;
}

export type updateUi_Time = {
}

export type updateUi_StringKVPair = {
  key: string;
  value: string;
}

export type updateUi_Status = {
  code: int;
  name: string;
  desc: string;
  fields: Array<StringKVPair>;
}

export type updateUi_UID = {
}

export type updateUi_DeviceID = {
}

export type updateUi_SigID = {
}

export type updateUi_KID = {
}

export type updateUi_Text = {
  data: string;
  markup: boolean;
}

export type updateUi_PGPIdentity = {
  username: string;
  comment: string;
  email: string;
}

export type updateUi_PublicKey = {
  KID: KID;
  PGPFingerprint: string;
  PGPIdentities: Array<PGPIdentity>;
  isSibkey: boolean;
  isEldest: boolean;
  parentID: string;
  deviceID: DeviceID;
  deviceDescription: string;
  deviceType: string;
  cTime: Time;
  eTime: Time;
}

export type updateUi_User = {
  uid: UID;
  username: string;
}

export type updateUi_Device = {
  type: string;
  name: string;
  deviceID: DeviceID;
  cTime: Time;
  mTime: Time;
}

export type updateUi_Stream = {
  fd: int;
}

export type updateUi_LogLevel = 0 /* 'NONE_0' */ | 1 /* 'DEBUG_1' */ | 2 /* 'INFO_2' */ | 3 /* 'NOTICE_3' */ | 4 /* 'WARN_4' */ | 5 /* 'ERROR_5' */ | 6 /* 'CRITICAL_6' */ | 7 /* 'FATAL_7' */

export type updateUi_ClientType = 0 /* 'CLI_0' */ | 1 /* 'GUI_1' */

export type updateUi_UserVersionVector = {
  id: long;
  sigHints: int;
  sigChain: long;
  cachedAt: Time;
  lastIdentifiedAt: Time;
}

export type updateUi_UserPlusKeys = {
  uid: UID;
  username: string;
  deviceKeys: Array<PublicKey>;
  keys: Array<PublicKey>;
  uvv: UserVersionVector;
}

export type updateUi_Asset = {
  name: string;
  url: string;
  localPath: string;
}

export type updateUi_UpdateType = 0 /* 'NORMAL_0' */ | 1 /* 'BUGFIX_1' */ | 2 /* 'CRITICAL_2' */

export type updateUi_Update = {
  version: string;
  name: string;
  description: string;
  type: UpdateType;
  asset: Asset;
}

export type updateUi_UpdateAction = 0 /* 'UPDATE_0' */ | 1 /* 'SKIP_1' */ | 2 /* 'SNOOZE_2' */ | 3 /* 'CANCEL_3' */

export type UpdateAction = 0 /* 'UPDATE_0' */ | 1 /* 'SKIP_1' */ | 2 /* 'SNOOZE_2' */ | 3 /* 'CANCEL_3' */

export type updateUi_UpdatePromptRes = {
  action: UpdateAction;
  alwaysAutoInstall: boolean;
  snoozeUntil: Time;
}

export type UpdatePromptRes = {
  action: UpdateAction;
  alwaysAutoInstall: boolean;
  snoozeUntil: Time;
}

export type user_Time = {
}

export type user_StringKVPair = {
  key: string;
  value: string;
}

export type user_Status = {
  code: int;
  name: string;
  desc: string;
  fields: Array<StringKVPair>;
}

export type user_UID = {
}

export type user_DeviceID = {
}

export type user_SigID = {
}

export type user_KID = {
}

export type user_Text = {
  data: string;
  markup: boolean;
}

export type user_PGPIdentity = {
  username: string;
  comment: string;
  email: string;
}

export type user_PublicKey = {
  KID: KID;
  PGPFingerprint: string;
  PGPIdentities: Array<PGPIdentity>;
  isSibkey: boolean;
  isEldest: boolean;
  parentID: string;
  deviceID: DeviceID;
  deviceDescription: string;
  deviceType: string;
  cTime: Time;
  eTime: Time;
}

export type user_User = {
  uid: UID;
  username: string;
}

export type user_Device = {
  type: string;
  name: string;
  deviceID: DeviceID;
  cTime: Time;
  mTime: Time;
}

export type user_Stream = {
  fd: int;
}

export type user_LogLevel = 0 /* 'NONE_0' */ | 1 /* 'DEBUG_1' */ | 2 /* 'INFO_2' */ | 3 /* 'NOTICE_3' */ | 4 /* 'WARN_4' */ | 5 /* 'ERROR_5' */ | 6 /* 'CRITICAL_6' */ | 7 /* 'FATAL_7' */

export type user_ClientType = 0 /* 'CLI_0' */ | 1 /* 'GUI_1' */

export type user_UserVersionVector = {
  id: long;
  sigHints: int;
  sigChain: long;
  cachedAt: Time;
  lastIdentifiedAt: Time;
}

export type user_UserPlusKeys = {
  uid: UID;
  username: string;
  deviceKeys: Array<PublicKey>;
  keys: Array<PublicKey>;
  uvv: UserVersionVector;
}

export type user_Asset = {
  name: string;
  url: string;
  localPath: string;
}

export type user_UpdateType = 0 /* 'NORMAL_0' */ | 1 /* 'BUGFIX_1' */ | 2 /* 'CRITICAL_2' */

export type user_Update = {
  version: string;
  name: string;
  description: string;
  type: UpdateType;
  asset: Asset;
}

export type user_Tracker = {
  tracker: UID;
  status: int;
  mTime: Time;
}

export type Tracker = {
  tracker: UID;
  status: int;
  mTime: Time;
}

export type user_TrackProof = {
  proofType: string;
  proofName: string;
  idString: string;
}

export type TrackProof = {
  proofType: string;
  proofName: string;
  idString: string;
}

export type user_WebProof = {
  hostname: string;
  protocols: Array<string>;
}

export type WebProof = {
  hostname: string;
  protocols: Array<string>;
}

export type user_Proofs = {
  social: Array<TrackProof>;
  web: Array<WebProof>;
  publicKeys: Array<PublicKey>;
}

export type Proofs = {
  social: Array<TrackProof>;
  web: Array<WebProof>;
  publicKeys: Array<PublicKey>;
}

export type user_UserSummary = {
  uid: UID;
  username: string;
  thumbnail: string;
  idVersion: int;
  fullName: string;
  bio: string;
  proofs: Proofs;
  sigIDDisplay: string;
  trackTime: Time;
}

export type UserSummary = {
  uid: UID;
  username: string;
  thumbnail: string;
  idVersion: int;
  fullName: string;
  bio: string;
  proofs: Proofs;
  sigIDDisplay: string;
  trackTime: Time;
}

export type user_SearchComponent = {
  key: string;
  value: string;
  score: double;
}

export type SearchComponent = {
  key: string;
  value: string;
  score: double;
}

export type user_SearchResult = {
  uid: UID;
  username: string;
  components: Array<SearchComponent>;
  score: double;
}

export type SearchResult = {
  uid: UID;
  username: string;
  components: Array<SearchComponent>;
  score: double;
}

