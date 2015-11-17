/* @flow */

export type int = number
export type double = number
export type bytes = any
export type ED25519PublicKey = any
export type ED25519Signature = any
export type block_Time = {
}

export type Time = {
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

export type SigID = {
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

export type block_LogLevel = 'NONE_0' | 'DEBUG_1' | 'INFO_2' | 'NOTICE_3' | 'WARN_4' | 'ERROR_5' | 'CRITICAL_6' | 'FATAL_7'

export type LogLevel = 'NONE_0' | 'DEBUG_1' | 'INFO_2' | 'NOTICE_3' | 'WARN_4' | 'ERROR_5' | 'CRITICAL_6' | 'FATAL_7'

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

export type BTC_LogLevel = 'NONE_0' | 'DEBUG_1' | 'INFO_2' | 'NOTICE_3' | 'WARN_4' | 'ERROR_5' | 'CRITICAL_6' | 'FATAL_7'

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

export type config_LogLevel = 'NONE_0' | 'DEBUG_1' | 'INFO_2' | 'NOTICE_3' | 'WARN_4' | 'ERROR_5' | 'CRITICAL_6' | 'FATAL_7'

export type config_GetCurrentStatusRes = {
  configured: boolean;
  registered: boolean;
  loggedIn: boolean;
  user: ?User;
}

export type GetCurrentStatusRes = {
  configured: boolean;
  registered: boolean;
  loggedIn: boolean;
  user: ?User;
}

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
}

export type config_InstallStatus = 'UNKNOWN_0' | 'ERROR_1' | 'NOT_INSTALLED_2' | 'NEEDS_UPGRADE_3' | 'INSTALLED_4'

export type InstallStatus = 'UNKNOWN_0' | 'ERROR_1' | 'NOT_INSTALLED_2' | 'NEEDS_UPGRADE_3' | 'INSTALLED_4'

export type config_InstallAction = 'UNKNOWN_0' | 'NONE_1' | 'UPGRADE_2' | 'REINSTALL_3' | 'INSTALL_4'

export type InstallAction = 'UNKNOWN_0' | 'NONE_1' | 'UPGRADE_2' | 'REINSTALL_3' | 'INSTALL_4'

export type config_ServiceStatus = {
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

export type config_FuseStatus = {
  version: string;
  bundleVersion: string;
  kextID: string;
  path: string;
  kextStarted: boolean;
  installStatus: InstallStatus;
  installAction: InstallAction;
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
  status: Status;
}

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

export type ctl_LogLevel = 'NONE_0' | 'DEBUG_1' | 'INFO_2' | 'NOTICE_3' | 'WARN_4' | 'ERROR_5' | 'CRITICAL_6' | 'FATAL_7'

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

export type delegateUiCtl_LogLevel = 'NONE_0' | 'DEBUG_1' | 'INFO_2' | 'NOTICE_3' | 'WARN_4' | 'ERROR_5' | 'CRITICAL_6' | 'FATAL_7'

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

export type device_LogLevel = 'NONE_0' | 'DEBUG_1' | 'INFO_2' | 'NOTICE_3' | 'WARN_4' | 'ERROR_5' | 'CRITICAL_6' | 'FATAL_7'

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

export type favorite_LogLevel = 'NONE_0' | 'DEBUG_1' | 'INFO_2' | 'NOTICE_3' | 'WARN_4' | 'ERROR_5' | 'CRITICAL_6' | 'FATAL_7'

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

export type gpgUi_LogLevel = 'NONE_0' | 'DEBUG_1' | 'INFO_2' | 'NOTICE_3' | 'WARN_4' | 'ERROR_5' | 'CRITICAL_6' | 'FATAL_7'

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

export type identify_LogLevel = 'NONE_0' | 'DEBUG_1' | 'INFO_2' | 'NOTICE_3' | 'WARN_4' | 'ERROR_5' | 'CRITICAL_6' | 'FATAL_7'

export type identify_ProofState = 'NONE_0' | 'OK_1' | 'TEMP_FAILURE_2' | 'PERM_FAILURE_3' | 'LOOKING_4' | 'SUPERSEDED_5' | 'POSTED_6' | 'REVOKED_7'

export type ProofState = 'NONE_0' | 'OK_1' | 'TEMP_FAILURE_2' | 'PERM_FAILURE_3' | 'LOOKING_4' | 'SUPERSEDED_5' | 'POSTED_6' | 'REVOKED_7'

export type identify_ProofStatus = 'NONE_0' | 'OK_1' | 'LOCAL_2' | 'FOUND_3' | 'BASE_ERROR_100' | 'HOST_UNREACHABLE_101' | 'PERMISSION_DENIED_103' | 'FAILED_PARSE_106' | 'DNS_ERROR_107' | 'AUTH_FAILED_108' | 'HTTP_500_150' | 'TIMEOUT_160' | 'INTERNAL_ERROR_170' | 'BASE_HARD_ERROR_200' | 'NOT_FOUND_201' | 'CONTENT_FAILURE_202' | 'BAD_USERNAME_203' | 'BAD_REMOTE_ID_204' | 'TEXT_NOT_FOUND_205' | 'BAD_ARGS_206' | 'CONTENT_MISSING_207' | 'TITLE_NOT_FOUND_208' | 'SERVICE_ERROR_209' | 'TOR_SKIPPED_210' | 'TOR_INCOMPATIBLE_211' | 'HTTP_300_230' | 'HTTP_400_240' | 'HTTP_OTHER_260' | 'EMPTY_JSON_270' | 'DELETED_301' | 'SERVICE_DEAD_302' | 'BAD_SIGNATURE_303' | 'BAD_API_URL_304' | 'UNKNOWN_TYPE_305' | 'NO_HINT_306' | 'BAD_HINT_TEXT_307'

export type ProofStatus = 'NONE_0' | 'OK_1' | 'LOCAL_2' | 'FOUND_3' | 'BASE_ERROR_100' | 'HOST_UNREACHABLE_101' | 'PERMISSION_DENIED_103' | 'FAILED_PARSE_106' | 'DNS_ERROR_107' | 'AUTH_FAILED_108' | 'HTTP_500_150' | 'TIMEOUT_160' | 'INTERNAL_ERROR_170' | 'BASE_HARD_ERROR_200' | 'NOT_FOUND_201' | 'CONTENT_FAILURE_202' | 'BAD_USERNAME_203' | 'BAD_REMOTE_ID_204' | 'TEXT_NOT_FOUND_205' | 'BAD_ARGS_206' | 'CONTENT_MISSING_207' | 'TITLE_NOT_FOUND_208' | 'SERVICE_ERROR_209' | 'TOR_SKIPPED_210' | 'TOR_INCOMPATIBLE_211' | 'HTTP_300_230' | 'HTTP_400_240' | 'HTTP_OTHER_260' | 'EMPTY_JSON_270' | 'DELETED_301' | 'SERVICE_DEAD_302' | 'BAD_SIGNATURE_303' | 'BAD_API_URL_304' | 'UNKNOWN_TYPE_305' | 'NO_HINT_306' | 'BAD_HINT_TEXT_307'

export type identify_ProofType = 'NONE_0' | 'KEYBASE_1' | 'TWITTER_2' | 'GITHUB_3' | 'REDDIT_4' | 'COINBASE_5' | 'HACKERNEWS_6' | 'GENERIC_WEB_SITE_1000' | 'DNS_1001' | 'ROOTER_100001'

export type ProofType = 'NONE_0' | 'KEYBASE_1' | 'TWITTER_2' | 'GITHUB_3' | 'REDDIT_4' | 'COINBASE_5' | 'HACKERNEWS_6' | 'GENERIC_WEB_SITE_1000' | 'DNS_1001' | 'ROOTER_100001'

export type identify_TrackDiffType = 'NONE_0' | 'ERROR_1' | 'CLASH_2' | 'REVOKED_3' | 'UPGRADED_4' | 'NEW_5' | 'REMOTE_FAIL_6' | 'REMOTE_WORKING_7' | 'REMOTE_CHANGED_8'

export type TrackDiffType = 'NONE_0' | 'ERROR_1' | 'CLASH_2' | 'REVOKED_3' | 'UPGRADED_4' | 'NEW_5' | 'REMOTE_FAIL_6' | 'REMOTE_WORKING_7' | 'REMOTE_CHANGED_8'

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

export type identify_TrackStatus = 'NEW_OK_1' | 'NEW_ZERO_PROOFS_2' | 'NEW_FAIL_PROOFS_3' | 'UPDATE_BROKEN_4' | 'UPDATE_NEW_PROOFS_5' | 'UPDATE_OK_6'

export type TrackStatus = 'NEW_OK_1' | 'NEW_ZERO_PROOFS_2' | 'NEW_FAIL_PROOFS_3' | 'UPDATE_BROKEN_4' | 'UPDATE_NEW_PROOFS_5' | 'UPDATE_OK_6'

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
  status: ?Status;
  warnings: Array<string>;
  trackUsed: ?TrackSummary;
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
  status: ?Status;
  warnings: Array<string>;
  trackUsed: ?TrackSummary;
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
  user: ?User;
  publicKeys: Array<PublicKey>;
  outcome: IdentifyOutcome;
  trackToken: string;
}

export type IdentifyRes = {
  user: ?User;
  publicKeys: Array<PublicKey>;
  outcome: IdentifyOutcome;
  trackToken: string;
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

export type identifyUi_LogLevel = 'NONE_0' | 'DEBUG_1' | 'INFO_2' | 'NOTICE_3' | 'WARN_4' | 'ERROR_5' | 'CRITICAL_6' | 'FATAL_7'

export type identifyUi_ProofState = 'NONE_0' | 'OK_1' | 'TEMP_FAILURE_2' | 'PERM_FAILURE_3' | 'LOOKING_4' | 'SUPERSEDED_5' | 'POSTED_6' | 'REVOKED_7'

export type identifyUi_ProofStatus = 'NONE_0' | 'OK_1' | 'LOCAL_2' | 'FOUND_3' | 'BASE_ERROR_100' | 'HOST_UNREACHABLE_101' | 'PERMISSION_DENIED_103' | 'FAILED_PARSE_106' | 'DNS_ERROR_107' | 'AUTH_FAILED_108' | 'HTTP_500_150' | 'TIMEOUT_160' | 'INTERNAL_ERROR_170' | 'BASE_HARD_ERROR_200' | 'NOT_FOUND_201' | 'CONTENT_FAILURE_202' | 'BAD_USERNAME_203' | 'BAD_REMOTE_ID_204' | 'TEXT_NOT_FOUND_205' | 'BAD_ARGS_206' | 'CONTENT_MISSING_207' | 'TITLE_NOT_FOUND_208' | 'SERVICE_ERROR_209' | 'TOR_SKIPPED_210' | 'TOR_INCOMPATIBLE_211' | 'HTTP_300_230' | 'HTTP_400_240' | 'HTTP_OTHER_260' | 'EMPTY_JSON_270' | 'DELETED_301' | 'SERVICE_DEAD_302' | 'BAD_SIGNATURE_303' | 'BAD_API_URL_304' | 'UNKNOWN_TYPE_305' | 'NO_HINT_306' | 'BAD_HINT_TEXT_307'

export type identifyUi_ProofType = 'NONE_0' | 'KEYBASE_1' | 'TWITTER_2' | 'GITHUB_3' | 'REDDIT_4' | 'COINBASE_5' | 'HACKERNEWS_6' | 'GENERIC_WEB_SITE_1000' | 'DNS_1001' | 'ROOTER_100001'

export type identifyUi_TrackDiffType = 'NONE_0' | 'ERROR_1' | 'CLASH_2' | 'REVOKED_3' | 'UPGRADED_4' | 'NEW_5' | 'REMOTE_FAIL_6' | 'REMOTE_WORKING_7' | 'REMOTE_CHANGED_8'

export type identifyUi_TrackDiff = {
  type: TrackDiffType;
  displayMarkup: string;
}

export type identifyUi_TrackSummary = {
  username: string;
  time: Time;
  isRemote: boolean;
}

export type identifyUi_TrackStatus = 'NEW_OK_1' | 'NEW_ZERO_PROOFS_2' | 'NEW_FAIL_PROOFS_3' | 'UPDATE_BROKEN_4' | 'UPDATE_NEW_PROOFS_5' | 'UPDATE_OK_6'

export type identifyUi_TrackOptions = {
  localOnly: boolean;
  bypassConfirm: boolean;
}

export type identifyUi_IdentifyOutcome = {
  username: string;
  status: ?Status;
  warnings: Array<string>;
  trackUsed: ?TrackSummary;
  trackStatus: TrackStatus;
  numTrackFailures: int;
  numTrackChanges: int;
  numProofFailures: int;
  numRevoked: int;
  numProofSuccesses: int;
  revoked: Array<TrackDiff>;
  trackOptions: TrackOptions;
  forPGPPull: boolean;
}

export type identifyUi_IdentifyRes = {
  user: ?User;
  publicKeys: Array<PublicKey>;
  outcome: IdentifyOutcome;
  trackToken: string;
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
  trackDiff: ?TrackDiff;
}

export type IdentifyRow = {
  rowId: int;
  proof: RemoteProof;
  trackDiff: ?TrackDiff;
}

export type identifyUi_IdentifyKey = {
  pgpFingerprint: bytes;
  KID: KID;
  trackDiff: ?TrackDiff;
}

export type IdentifyKey = {
  pgpFingerprint: bytes;
  KID: KID;
  trackDiff: ?TrackDiff;
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
  status: ?Status;
  whenLastTracked: int;
  proofs: Array<IdentifyRow>;
  cryptocurrency: Array<Cryptocurrency>;
  revoked: Array<TrackDiff>;
}

export type Identity = {
  status: ?Status;
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
  cached: ?CheckResult;
  diff: ?TrackDiff;
  remoteDiff: ?TrackDiff;
  hint: ?SigHint;
}

export type LinkCheckResult = {
  proofId: int;
  proofResult: ProofResult;
  torWarning: boolean;
  cached: ?CheckResult;
  diff: ?TrackDiff;
  remoteDiff: ?TrackDiff;
  hint: ?SigHint;
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

export type Kex2Provisionee_LogLevel = 'NONE_0' | 'DEBUG_1' | 'INFO_2' | 'NOTICE_3' | 'WARN_4' | 'ERROR_5' | 'CRITICAL_6' | 'FATAL_7'

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

export type logUi_LogLevel = 'NONE_0' | 'DEBUG_1' | 'INFO_2' | 'NOTICE_3' | 'WARN_4' | 'ERROR_5' | 'CRITICAL_6' | 'FATAL_7'

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

export type login_LogLevel = 'NONE_0' | 'DEBUG_1' | 'INFO_2' | 'NOTICE_3' | 'WARN_4' | 'ERROR_5' | 'CRITICAL_6' | 'FATAL_7'

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

export type loginUi_LogLevel = 'NONE_0' | 'DEBUG_1' | 'INFO_2' | 'NOTICE_3' | 'WARN_4' | 'ERROR_5' | 'CRITICAL_6' | 'FATAL_7'

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

export type metadata_LogLevel = 'NONE_0' | 'DEBUG_1' | 'INFO_2' | 'NOTICE_3' | 'WARN_4' | 'ERROR_5' | 'CRITICAL_6' | 'FATAL_7'

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

export type metadata_FolderUsersResponse = {
  readers: Array<UID>;
  writers: Array<UID>;
}

export type FolderUsersResponse = {
  readers: Array<UID>;
  writers: Array<UID>;
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

export type metadataUpdate_LogLevel = 'NONE_0' | 'DEBUG_1' | 'INFO_2' | 'NOTICE_3' | 'WARN_4' | 'ERROR_5' | 'CRITICAL_6' | 'FATAL_7'

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

export type notifyCtl_LogLevel = 'NONE_0' | 'DEBUG_1' | 'INFO_2' | 'NOTICE_3' | 'WARN_4' | 'ERROR_5' | 'CRITICAL_6' | 'FATAL_7'

export type notifyCtl_NotificationChannels = {
  session: boolean;
  users: boolean;
}

export type NotificationChannels = {
  session: boolean;
  users: boolean;
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

export type NotifyUsers_LogLevel = 'NONE_0' | 'DEBUG_1' | 'INFO_2' | 'NOTICE_3' | 'WARN_4' | 'ERROR_5' | 'CRITICAL_6' | 'FATAL_7'

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

export type pgp_LogLevel = 'NONE_0' | 'DEBUG_1' | 'INFO_2' | 'NOTICE_3' | 'WARN_4' | 'ERROR_5' | 'CRITICAL_6' | 'FATAL_7'

export type pgp_ProofState = 'NONE_0' | 'OK_1' | 'TEMP_FAILURE_2' | 'PERM_FAILURE_3' | 'LOOKING_4' | 'SUPERSEDED_5' | 'POSTED_6' | 'REVOKED_7'

export type pgp_ProofStatus = 'NONE_0' | 'OK_1' | 'LOCAL_2' | 'FOUND_3' | 'BASE_ERROR_100' | 'HOST_UNREACHABLE_101' | 'PERMISSION_DENIED_103' | 'FAILED_PARSE_106' | 'DNS_ERROR_107' | 'AUTH_FAILED_108' | 'HTTP_500_150' | 'TIMEOUT_160' | 'INTERNAL_ERROR_170' | 'BASE_HARD_ERROR_200' | 'NOT_FOUND_201' | 'CONTENT_FAILURE_202' | 'BAD_USERNAME_203' | 'BAD_REMOTE_ID_204' | 'TEXT_NOT_FOUND_205' | 'BAD_ARGS_206' | 'CONTENT_MISSING_207' | 'TITLE_NOT_FOUND_208' | 'SERVICE_ERROR_209' | 'TOR_SKIPPED_210' | 'TOR_INCOMPATIBLE_211' | 'HTTP_300_230' | 'HTTP_400_240' | 'HTTP_OTHER_260' | 'EMPTY_JSON_270' | 'DELETED_301' | 'SERVICE_DEAD_302' | 'BAD_SIGNATURE_303' | 'BAD_API_URL_304' | 'UNKNOWN_TYPE_305' | 'NO_HINT_306' | 'BAD_HINT_TEXT_307'

export type pgp_ProofType = 'NONE_0' | 'KEYBASE_1' | 'TWITTER_2' | 'GITHUB_3' | 'REDDIT_4' | 'COINBASE_5' | 'HACKERNEWS_6' | 'GENERIC_WEB_SITE_1000' | 'DNS_1001' | 'ROOTER_100001'

export type pgp_TrackDiffType = 'NONE_0' | 'ERROR_1' | 'CLASH_2' | 'REVOKED_3' | 'UPGRADED_4' | 'NEW_5' | 'REMOTE_FAIL_6' | 'REMOTE_WORKING_7' | 'REMOTE_CHANGED_8'

export type pgp_TrackDiff = {
  type: TrackDiffType;
  displayMarkup: string;
}

export type pgp_TrackSummary = {
  username: string;
  time: Time;
  isRemote: boolean;
}

export type pgp_TrackStatus = 'NEW_OK_1' | 'NEW_ZERO_PROOFS_2' | 'NEW_FAIL_PROOFS_3' | 'UPDATE_BROKEN_4' | 'UPDATE_NEW_PROOFS_5' | 'UPDATE_OK_6'

export type pgp_TrackOptions = {
  localOnly: boolean;
  bypassConfirm: boolean;
}

export type pgp_IdentifyOutcome = {
  username: string;
  status: ?Status;
  warnings: Array<string>;
  trackUsed: ?TrackSummary;
  trackStatus: TrackStatus;
  numTrackFailures: int;
  numTrackChanges: int;
  numProofFailures: int;
  numRevoked: int;
  numProofSuccesses: int;
  revoked: Array<TrackDiff>;
  trackOptions: TrackOptions;
  forPGPPull: boolean;
}

export type pgp_IdentifyRes = {
  user: ?User;
  publicKeys: Array<PublicKey>;
  outcome: IdentifyOutcome;
  trackToken: string;
}

export type pgp_RemoteProof = {
  proofType: ProofType;
  key: string;
  value: string;
  displayMarkup: string;
  sigID: SigID;
  mTime: Time;
}

export type pgp_SignMode = 'ATTACHED_0' | 'DETACHED_1' | 'CLEAR_2'

export type SignMode = 'ATTACHED_0' | 'DETACHED_1' | 'CLEAR_2'

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
  trackOptions: TrackOptions;
}

export type PGPEncryptOptions = {
  recipients: Array<string>;
  noSign: boolean;
  noSelf: boolean;
  binaryOut: boolean;
  keyQuery: string;
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
  trackOptions: TrackOptions;
}

export type PGPDecryptOptions = {
  assertSigned: boolean;
  signedBy: string;
  trackOptions: TrackOptions;
}

export type pgp_PGPVerifyOptions = {
  signedBy: string;
  trackOptions: TrackOptions;
  signature: bytes;
}

export type PGPVerifyOptions = {
  signedBy: string;
  trackOptions: TrackOptions;
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

export type prove_LogLevel = 'NONE_0' | 'DEBUG_1' | 'INFO_2' | 'NOTICE_3' | 'WARN_4' | 'ERROR_5' | 'CRITICAL_6' | 'FATAL_7'

export type prove_ProofState = 'NONE_0' | 'OK_1' | 'TEMP_FAILURE_2' | 'PERM_FAILURE_3' | 'LOOKING_4' | 'SUPERSEDED_5' | 'POSTED_6' | 'REVOKED_7'

export type prove_ProofStatus = 'NONE_0' | 'OK_1' | 'LOCAL_2' | 'FOUND_3' | 'BASE_ERROR_100' | 'HOST_UNREACHABLE_101' | 'PERMISSION_DENIED_103' | 'FAILED_PARSE_106' | 'DNS_ERROR_107' | 'AUTH_FAILED_108' | 'HTTP_500_150' | 'TIMEOUT_160' | 'INTERNAL_ERROR_170' | 'BASE_HARD_ERROR_200' | 'NOT_FOUND_201' | 'CONTENT_FAILURE_202' | 'BAD_USERNAME_203' | 'BAD_REMOTE_ID_204' | 'TEXT_NOT_FOUND_205' | 'BAD_ARGS_206' | 'CONTENT_MISSING_207' | 'TITLE_NOT_FOUND_208' | 'SERVICE_ERROR_209' | 'TOR_SKIPPED_210' | 'TOR_INCOMPATIBLE_211' | 'HTTP_300_230' | 'HTTP_400_240' | 'HTTP_OTHER_260' | 'EMPTY_JSON_270' | 'DELETED_301' | 'SERVICE_DEAD_302' | 'BAD_SIGNATURE_303' | 'BAD_API_URL_304' | 'UNKNOWN_TYPE_305' | 'NO_HINT_306' | 'BAD_HINT_TEXT_307'

export type prove_ProofType = 'NONE_0' | 'KEYBASE_1' | 'TWITTER_2' | 'GITHUB_3' | 'REDDIT_4' | 'COINBASE_5' | 'HACKERNEWS_6' | 'GENERIC_WEB_SITE_1000' | 'DNS_1001' | 'ROOTER_100001'

export type prove_TrackDiffType = 'NONE_0' | 'ERROR_1' | 'CLASH_2' | 'REVOKED_3' | 'UPGRADED_4' | 'NEW_5' | 'REMOTE_FAIL_6' | 'REMOTE_WORKING_7' | 'REMOTE_CHANGED_8'

export type prove_TrackDiff = {
  type: TrackDiffType;
  displayMarkup: string;
}

export type prove_TrackSummary = {
  username: string;
  time: Time;
  isRemote: boolean;
}

export type prove_TrackStatus = 'NEW_OK_1' | 'NEW_ZERO_PROOFS_2' | 'NEW_FAIL_PROOFS_3' | 'UPDATE_BROKEN_4' | 'UPDATE_NEW_PROOFS_5' | 'UPDATE_OK_6'

export type prove_TrackOptions = {
  localOnly: boolean;
  bypassConfirm: boolean;
}

export type prove_IdentifyOutcome = {
  username: string;
  status: ?Status;
  warnings: Array<string>;
  trackUsed: ?TrackSummary;
  trackStatus: TrackStatus;
  numTrackFailures: int;
  numTrackChanges: int;
  numProofFailures: int;
  numRevoked: int;
  numProofSuccesses: int;
  revoked: Array<TrackDiff>;
  trackOptions: TrackOptions;
  forPGPPull: boolean;
}

export type prove_IdentifyRes = {
  user: ?User;
  publicKeys: Array<PublicKey>;
  outcome: IdentifyOutcome;
  trackToken: string;
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

export type proveUi_LogLevel = 'NONE_0' | 'DEBUG_1' | 'INFO_2' | 'NOTICE_3' | 'WARN_4' | 'ERROR_5' | 'CRITICAL_6' | 'FATAL_7'

export type proveUi_PromptOverwriteType = 'SOCIAL_0' | 'SITE_1'

export type PromptOverwriteType = 'SOCIAL_0' | 'SITE_1'

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

export type provisionUi_LogLevel = 'NONE_0' | 'DEBUG_1' | 'INFO_2' | 'NOTICE_3' | 'WARN_4' | 'ERROR_5' | 'CRITICAL_6' | 'FATAL_7'

export type provisionUi_ProvisionMethod = 'DEVICE_0' | 'GPG_1' | 'PAPER_KEY_2' | 'PASSPHRASE_3'

export type ProvisionMethod = 'DEVICE_0' | 'GPG_1' | 'PAPER_KEY_2' | 'PASSPHRASE_3'

export type provisionUi_DeviceType = 'DESKTOP_0' | 'MOBILE_1'

export type DeviceType = 'DESKTOP_0' | 'MOBILE_1'

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

export type quota_LogLevel = 'NONE_0' | 'DEBUG_1' | 'INFO_2' | 'NOTICE_3' | 'WARN_4' | 'ERROR_5' | 'CRITICAL_6' | 'FATAL_7'

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

export type revoke_LogLevel = 'NONE_0' | 'DEBUG_1' | 'INFO_2' | 'NOTICE_3' | 'WARN_4' | 'ERROR_5' | 'CRITICAL_6' | 'FATAL_7'

export type secretUi_Time = {
}

export type secretUi_StringKVPair = {
  key: string;
  value: string;
}

export type secretUi_Status = {
  code: int;
  name: string;
  desc: string;
  fields: Array<StringKVPair>;
}

export type secretUi_UID = {
}

export type secretUi_DeviceID = {
}

export type secretUi_SigID = {
}

export type secretUi_KID = {
}

export type secretUi_Text = {
  data: string;
  markup: boolean;
}

export type secretUi_PGPIdentity = {
  username: string;
  comment: string;
  email: string;
}

export type secretUi_PublicKey = {
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

export type secretUi_User = {
  uid: UID;
  username: string;
}

export type secretUi_Device = {
  type: string;
  name: string;
  deviceID: DeviceID;
  cTime: Time;
  mTime: Time;
}

export type secretUi_Stream = {
  fd: int;
}

export type secretUi_LogLevel = 'NONE_0' | 'DEBUG_1' | 'INFO_2' | 'NOTICE_3' | 'WARN_4' | 'ERROR_5' | 'CRITICAL_6' | 'FATAL_7'

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

export type secretUi_GetPassphraseRes = {
  passphrase: string;
  storeSecret: boolean;
}

export type GetPassphraseRes = {
  passphrase: string;
  storeSecret: boolean;
}

export type secretUi_SecretStorageFeature = {
  allow: boolean;
  label: string;
}

export type SecretStorageFeature = {
  allow: boolean;
  label: string;
}

export type secretUi_GUIEntryFeatures = {
  secretStorage: SecretStorageFeature;
}

export type GUIEntryFeatures = {
  secretStorage: SecretStorageFeature;
}

export type secretUi_GUIEntryArg = {
  windowTitle: string;
  prompt: string;
  retryLabel: string;
  features: GUIEntryFeatures;
}

export type GUIEntryArg = {
  windowTitle: string;
  prompt: string;
  retryLabel: string;
  features: GUIEntryFeatures;
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

export type session_LogLevel = 'NONE_0' | 'DEBUG_1' | 'INFO_2' | 'NOTICE_3' | 'WARN_4' | 'ERROR_5' | 'CRITICAL_6' | 'FATAL_7'

export type session_Session = {
  uid: UID;
  username: string;
  token: string;
  deviceSubkeyKid: KID;
}

export type Session = {
  uid: UID;
  username: string;
  token: string;
  deviceSubkeyKid: KID;
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

export type signup_LogLevel = 'NONE_0' | 'DEBUG_1' | 'INFO_2' | 'NOTICE_3' | 'WARN_4' | 'ERROR_5' | 'CRITICAL_6' | 'FATAL_7'

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

export type sigs_LogLevel = 'NONE_0' | 'DEBUG_1' | 'INFO_2' | 'NOTICE_3' | 'WARN_4' | 'ERROR_5' | 'CRITICAL_6' | 'FATAL_7'

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
  types: ?SigTypes;
  filterx: string;
  verbose: boolean;
  revoked: boolean;
}

export type SigListArgs = {
  sessionID: int;
  username: string;
  allKeys: boolean;
  types: ?SigTypes;
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

export type streamUi_LogLevel = 'NONE_0' | 'DEBUG_1' | 'INFO_2' | 'NOTICE_3' | 'WARN_4' | 'ERROR_5' | 'CRITICAL_6' | 'FATAL_7'

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

export type track_LogLevel = 'NONE_0' | 'DEBUG_1' | 'INFO_2' | 'NOTICE_3' | 'WARN_4' | 'ERROR_5' | 'CRITICAL_6' | 'FATAL_7'

export type track_ProofState = 'NONE_0' | 'OK_1' | 'TEMP_FAILURE_2' | 'PERM_FAILURE_3' | 'LOOKING_4' | 'SUPERSEDED_5' | 'POSTED_6' | 'REVOKED_7'

export type track_ProofStatus = 'NONE_0' | 'OK_1' | 'LOCAL_2' | 'FOUND_3' | 'BASE_ERROR_100' | 'HOST_UNREACHABLE_101' | 'PERMISSION_DENIED_103' | 'FAILED_PARSE_106' | 'DNS_ERROR_107' | 'AUTH_FAILED_108' | 'HTTP_500_150' | 'TIMEOUT_160' | 'INTERNAL_ERROR_170' | 'BASE_HARD_ERROR_200' | 'NOT_FOUND_201' | 'CONTENT_FAILURE_202' | 'BAD_USERNAME_203' | 'BAD_REMOTE_ID_204' | 'TEXT_NOT_FOUND_205' | 'BAD_ARGS_206' | 'CONTENT_MISSING_207' | 'TITLE_NOT_FOUND_208' | 'SERVICE_ERROR_209' | 'TOR_SKIPPED_210' | 'TOR_INCOMPATIBLE_211' | 'HTTP_300_230' | 'HTTP_400_240' | 'HTTP_OTHER_260' | 'EMPTY_JSON_270' | 'DELETED_301' | 'SERVICE_DEAD_302' | 'BAD_SIGNATURE_303' | 'BAD_API_URL_304' | 'UNKNOWN_TYPE_305' | 'NO_HINT_306' | 'BAD_HINT_TEXT_307'

export type track_ProofType = 'NONE_0' | 'KEYBASE_1' | 'TWITTER_2' | 'GITHUB_3' | 'REDDIT_4' | 'COINBASE_5' | 'HACKERNEWS_6' | 'GENERIC_WEB_SITE_1000' | 'DNS_1001' | 'ROOTER_100001'

export type track_TrackDiffType = 'NONE_0' | 'ERROR_1' | 'CLASH_2' | 'REVOKED_3' | 'UPGRADED_4' | 'NEW_5' | 'REMOTE_FAIL_6' | 'REMOTE_WORKING_7' | 'REMOTE_CHANGED_8'

export type track_TrackDiff = {
  type: TrackDiffType;
  displayMarkup: string;
}

export type track_TrackSummary = {
  username: string;
  time: Time;
  isRemote: boolean;
}

export type track_TrackStatus = 'NEW_OK_1' | 'NEW_ZERO_PROOFS_2' | 'NEW_FAIL_PROOFS_3' | 'UPDATE_BROKEN_4' | 'UPDATE_NEW_PROOFS_5' | 'UPDATE_OK_6'

export type track_TrackOptions = {
  localOnly: boolean;
  bypassConfirm: boolean;
}

export type track_IdentifyOutcome = {
  username: string;
  status: ?Status;
  warnings: Array<string>;
  trackUsed: ?TrackSummary;
  trackStatus: TrackStatus;
  numTrackFailures: int;
  numTrackChanges: int;
  numProofFailures: int;
  numRevoked: int;
  numProofSuccesses: int;
  revoked: Array<TrackDiff>;
  trackOptions: TrackOptions;
  forPGPPull: boolean;
}

export type track_IdentifyRes = {
  user: ?User;
  publicKeys: Array<PublicKey>;
  outcome: IdentifyOutcome;
  trackToken: string;
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

export type ui_LogLevel = 'NONE_0' | 'DEBUG_1' | 'INFO_2' | 'NOTICE_3' | 'WARN_4' | 'ERROR_5' | 'CRITICAL_6' | 'FATAL_7'

export type ui_PromptDefault = 'NONE_0' | 'YES_1' | 'NO_2'

export type PromptDefault = 'NONE_0' | 'YES_1' | 'NO_2'

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

export type user_LogLevel = 'NONE_0' | 'DEBUG_1' | 'INFO_2' | 'NOTICE_3' | 'WARN_4' | 'ERROR_5' | 'CRITICAL_6' | 'FATAL_7'

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

export type user_UserPlusKeys = {
  uid: UID;
  username: string;
  deviceKeys: Array<PublicKey>;
}

export type UserPlusKeys = {
  uid: UID;
  username: string;
  deviceKeys: Array<PublicKey>;
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

