/* @flow */

export type int = number
export type long = number
export type double = number
export type bytes = any
export type RPCError = {
  code: number,
  desc: string
}

export type Asset = {
  name: string;
  url: string;
  digest: string;
  signature: string;
  localPath: string;
}

export type BTC_registerBTC_result = void

export type BTC_registerBTC_rpc = {
  method: 'BTC.registerBTC',
  param: {
    address: string,
    force: boolean
  },
  incomingCallMap: ?incomingCallMapType,
  callback: (null | (err: ?any) => void)
}

export type BlockIdCombo = {
  blockHash: string;
  chargedTo: UID;
}

export type BlockRefNonce = any

export type BlockReference = {
  bid: BlockIdCombo;
  nonce: BlockRefNonce;
  chargedTo: UID;
}

export type BoxNonce = any

export type BoxPublicKey = any

export type Bytes32 = any

export type ChallengeInfo = {
  now: long;
  challenge: string;
}

export type CheckProofStatus = {
  found: boolean;
  status: ProofStatus;
  proofText: string;
}

export type CheckResult = {
  proofResult: ProofResult;
  time: Time;
  freshness: CheckResultFreshness;
}

export type CheckResultFreshness =
    0 // FRESH_0
  | 1 // AGED_1
  | 2 // RANCID_2

export type ChooseType =
    0 // EXISTING_DEVICE_0
  | 1 // NEW_DEVICE_1

export type CiphertextBundle = {
  kid: KID;
  ciphertext: EncryptedBytes32;
  nonce: BoxNonce;
  publicKey: BoxPublicKey;
}

export type ClientDetails = {
  pid: int;
  clientType: ClientType;
  argv: Array<string>;
  desc: string;
  version: string;
}

export type ClientType = 2 // FORCE GUI ONLY

export type ComponentResult = {
  name: string;
  status: Status;
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

export type ConfigValue = {
  isNull: boolean;
  b?: ?boolean;
  i?: ?int;
  s?: ?string;
  o?: ?string;
}

export type ConfiguredAccount = {
  username: string;
  hasStoredSecret: boolean;
}

export type ConfirmResult = {
  identityConfirmed: boolean;
  remoteConfirmed: boolean;
  expiringLocal: boolean;
}

export type Cryptocurrency = {
  rowId: int;
  pkhash: bytes;
  address: string;
}

export type CsrfToken = string

export type Device = {
  type: string;
  name: string;
  deviceID: DeviceID;
  cTime: Time;
  mTime: Time;
  encryptKey: KID;
  verifyKey: KID;
  status: int;
}

export type DeviceID = string

export type DeviceType =
    0 // DESKTOP_0
  | 1 // MOBILE_1

export type ED25519PublicKey = any

export type ED25519Signature = any

export type ED25519SignatureInfo = {
  sig: ED25519Signature;
  publicKey: ED25519PublicKey;
}

export type EncryptedBytes32 = any

export type ExitCode =
    0 // OK_0
  | 2 // NOTOK_2
  | 4 // RESTART_4

export type ExtendedStatus = {
  standalone: boolean;
  passphraseStreamCached: boolean;
  device?: ?Device;
  logDir: string;
  session?: ?SessionStatus;
  defaultUsername: string;
  provisionedUsernames: Array<string>;
  Clients: Array<ClientDetails>;
  platformInfo: PlatformInfo;
}

export type FSErrorType =
    0 // ACCESS_DENIED_0
  | 1 // USER_NOT_FOUND_1
  | 2 // REVOKED_DATA_DETECTED_2
  | 3 // NOT_LOGGED_IN_3
  | 4 // TIMEOUT_4
  | 5 // REKEY_NEEDED_5
  | 6 // BAD_FOLDER_6
  | 7 // NOT_IMPLEMENTED_7

export type FSNotification = {
  publicTopLevelFolder: boolean;
  filename: string;
  status: string;
  statusCode: FSStatusCode;
  notificationType: FSNotificationType;
  errorType: FSErrorType;
  params: {string: string};
}

export type FSNotificationType =
    0 // ENCRYPTING_0
  | 1 // DECRYPTING_1
  | 2 // SIGNING_2
  | 3 // VERIFYING_3
  | 4 // REKEYING_4
  | 5 // CONNECTION_5

export type FSStatusCode =
    0 // START_0
  | 1 // FINISH_1
  | 2 // ERROR_2

export type Feature = {
  allow: boolean;
  defaultValue: boolean;
  readonly: boolean;
  label: string;
}

export type FileDescriptor = {
  name: string;
  type: FileType;
}

export type FileType =
    0 // UNKNOWN_0
  | 1 // DIRECTORY_1
  | 2 // FILE_2

export type FirstStepResult = {
  valPlusTwo: int;
}

export type Folder = {
  name: string;
  private: boolean;
  notificationsOn: boolean;
}

export type ForkType =
    0 // NONE_0
  | 1 // AUTO_1
  | 2 // WATCHDOG_2
  | 3 // LAUNCHD_3

export type FuseMountInfo = {
  path: string;
  fstype: string;
  output: string;
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

export type GPGKey = {
  algorithm: string;
  keyID: string;
  creation: string;
  expiration: string;
  identities: Array<PGPIdentity>;
}

export type GPGMethod =
    0 // GPG_NONE_0
  | 1 // GPG_IMPORT_1
  | 2 // GPG_SIGN_2

export type GUIEntryArg = {
  windowTitle: string;
  prompt: string;
  submitLabel: string;
  cancelLabel: string;
  retryLabel: string;
  type: PassphraseType;
  features: GUIEntryFeatures;
}

export type GUIEntryFeatures = {
  storeSecret: Feature;
  showTyping: Feature;
}

export type GetBlockRes = {
  blockKey: string;
  buf: bytes;
}

export type GetCurrentStatusRes = {
  configured: boolean;
  registered: boolean;
  loggedIn: boolean;
  sessionIsValid: boolean;
  user?: ?User;
}

export type GetPassphraseRes = {
  passphrase: string;
  storeSecret: boolean;
}

export type HelloRes = string

export type Identify2Res = {
  upk: UserPlusKeys;
}

export type IdentifyKey = {
  pgpFingerprint: bytes;
  KID: KID;
  trackDiff?: ?TrackDiff;
  breaksTracking: bool;
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

export type IdentifyReason = {
  type: IdentifyReasonType;
  reason: string;
  resource: string;
}

export type IdentifyReasonType =
    0 // NONE_0
  | 1 // ID_1
  | 2 // TRACK_2
  | 3 // ENCRYPT_3
  | 4 // DECRYPT_4
  | 5 // VERIFY_5
  | 6 // RESOURCE_6

export type IdentifyRes = {
  user?: ?User;
  publicKeys: Array<PublicKey>;
  outcome: IdentifyOutcome;
  trackToken: TrackToken;
}

export type IdentifyRow = {
  rowId: int;
  proof: RemoteProof;
  trackDiff?: ?TrackDiff;
}

export type Identity = {
  status?: ?Status;
  whenLastTracked: Time;
  proofs: Array<IdentifyRow>;
  cryptocurrency: Array<Cryptocurrency>;
  revoked: Array<TrackDiff>;
  breaksTracking: bool;
}

export type InstallAction =
    0 // UNKNOWN_0
  | 1 // NONE_1
  | 2 // UPGRADE_2
  | 3 // REINSTALL_3
  | 4 // INSTALL_4

export type InstallResult = {
  componentResults: Array<ComponentResult>;
  status: Status;
  fatal: boolean;
}

export type InstallStatus =
    0 // UNKNOWN_0
  | 1 // ERROR_1
  | 2 // NOT_INSTALLED_2
  | 4 // INSTALLED_4

export type KID = string

export type Kex2Provisionee_didCounterSign_result = void

export type Kex2Provisionee_didCounterSign_rpc = {
  method: 'Kex2Provisionee.didCounterSign',
  param: {
    sig: bytes
  },
  incomingCallMap: ?incomingCallMapType,
  callback: (null | (err: ?any) => void)
}

export type Kex2Provisionee_hello_result = HelloRes

export type Kex2Provisionee_hello_rpc = {
  method: 'Kex2Provisionee.hello',
  param: {
    uid: UID,
    token: SessionToken,
    csrf: CsrfToken,
    pps: PassphraseStream,
    sigBody: string
  },
  incomingCallMap: ?incomingCallMapType,
  callback: (null | (err: ?any, response: Kex2Provisionee_hello_result) => void)
}

export type Kex2Provisioner_kexStart_result = void

export type Kex2Provisioner_kexStart_rpc = {
  method: 'Kex2Provisioner.kexStart',
  param: {},
  incomingCallMap: ?incomingCallMapType,
  callback: (null | (err: ?any) => void)
}

export type KeyHalf = {
  user: UID;
  deviceKID: KID;
  key: bytes;
}

export type KeyInfo = {
  fingerprint: string;
  key: string;
  desc: string;
}

export type KeybaseTime = {
  unix: Time;
  chain: int;
}

export type LinkCheckResult = {
  proofId: int;
  proofResult: ProofResult;
  snoozedResult: ProofResult;
  torWarning: boolean;
  tmpTrackExpireTime: Time;
  cached?: ?CheckResult;
  diff?: ?TrackDiff;
  remoteDiff?: ?TrackDiff;
  hint?: ?SigHint;
  breaksTracking: bool;
}

export type LogLevel =
    0 // NONE_0
  | 1 // DEBUG_1
  | 2 // INFO_2
  | 3 // NOTICE_3
  | 4 // WARN_4
  | 5 // ERROR_5
  | 6 // CRITICAL_6
  | 7 // FATAL_7

export type MDBlock = {
  version: int;
  timestamp: Time;
  block: bytes;
}

export type MerkleRoot = {
  version: int;
  root: bytes;
}

export type MerkleTreeID =
    0 // MASTER_0
  | 1 // KBFS_PUBLIC_1
  | 2 // KBFS_PRIVATE_2

export type MetadataResponse = {
  folderID: string;
  mdBlocks: Array<MDBlock>;
}

export type NaclDHKeyPrivate = any

export type NaclDHKeyPublic = any

export type NaclSigningKeyPrivate = any

export type NaclSigningKeyPublic = any

export type NotificationChannels = {
  session: boolean;
  users: boolean;
  kbfs: boolean;
  tracking: boolean;
}

export type NotifyFS_FSActivity_result = void

export type NotifyFS_FSActivity_rpc = {
  method: 'NotifyFS.FSActivity',
  param: {
    notification: FSNotification
  },
  incomingCallMap: ?incomingCallMapType,
  callback: (null | (err: ?any) => void)
}

export type NotifySession_loggedIn_result = void

export type NotifySession_loggedIn_rpc = {
  method: 'NotifySession.loggedIn',
  param: {
    username: string
  },
  incomingCallMap: ?incomingCallMapType,
  callback: (null | (err: ?any) => void)
}

export type NotifySession_loggedOut_result = void

export type NotifySession_loggedOut_rpc = {
  method: 'NotifySession.loggedOut',
  param: {},
  incomingCallMap: ?incomingCallMapType,
  callback: (null | (err: ?any) => void)
}

export type NotifyTracking_trackingChanged_result = void

export type NotifyTracking_trackingChanged_rpc = {
  method: 'NotifyTracking.trackingChanged',
  param: {
    uid: UID,
    username: string
  },
  incomingCallMap: ?incomingCallMapType,
  callback: (null | (err: ?any) => void)
}

export type NotifyUsers_userChanged_result = void

export type NotifyUsers_userChanged_rpc = {
  method: 'NotifyUsers.userChanged',
  param: {
    uid: UID
  },
  incomingCallMap: ?incomingCallMapType,
  callback: (null | (err: ?any) => void)
}

export type PGPCreateUids = {
  useDefault: boolean;
  ids: Array<PGPIdentity>;
}

export type PGPDecryptOptions = {
  assertSigned: boolean;
  signedBy: string;
}

export type PGPEncryptOptions = {
  recipients: Array<string>;
  noSign: boolean;
  noSelf: boolean;
  binaryOut: boolean;
  keyQuery: string;
}

export type PGPIdentity = {
  username: string;
  comment: string;
  email: string;
}

export type PGPQuery = {
  secret: boolean;
  query: string;
  exactMatch: boolean;
}

export type PGPSigVerification = {
  isSigned: boolean;
  verified: boolean;
  signer: User;
  signKey: PublicKey;
}

export type PGPSignOptions = {
  keyQuery: string;
  mode: SignMode;
  binaryIn: boolean;
  binaryOut: boolean;
}

export type PGPVerifyOptions = {
  signedBy: string;
  signature: bytes;
}

export type PassphraseStream = {
  passphraseStream: bytes;
  generation: int;
}

export type PassphraseType =
    0 // NONE_0
  | 1 // PAPER_KEY_1
  | 2 // PASS_PHRASE_2
  | 3 // VERIFY_PASS_PHRASE_3

export type PlatformInfo = {
  os: string;
  arch: string;
  goVersion: string;
}

export type Process = {
  pid: string;
  command: string;
  fileDescriptors: Array<FileDescriptor>;
}

export type PromptDefault =
    0 // NONE_0
  | 1 // YES_1
  | 2 // NO_2

export type PromptOverwriteType =
    0 // SOCIAL_0
  | 1 // SITE_1

export type ProofResult = {
  state: ProofState;
  status: ProofStatus;
  desc: string;
}

export type ProofState =
    0 // NONE_0
  | 1 // OK_1
  | 2 // TEMP_FAILURE_2
  | 3 // PERM_FAILURE_3
  | 4 // LOOKING_4
  | 5 // SUPERSEDED_5
  | 6 // POSTED_6
  | 7 // REVOKED_7

export type ProofStatus =
    0 // NONE_0
  | 1 // OK_1
  | 2 // LOCAL_2
  | 3 // FOUND_3
  | 100 // BASE_ERROR_100
  | 101 // HOST_UNREACHABLE_101
  | 103 // PERMISSION_DENIED_103
  | 106 // FAILED_PARSE_106
  | 107 // DNS_ERROR_107
  | 108 // AUTH_FAILED_108
  | 129 // HTTP_429_129
  | 150 // HTTP_500_150
  | 160 // TIMEOUT_160
  | 170 // INTERNAL_ERROR_170
  | 200 // BASE_HARD_ERROR_200
  | 201 // NOT_FOUND_201
  | 202 // CONTENT_FAILURE_202
  | 203 // BAD_USERNAME_203
  | 204 // BAD_REMOTE_ID_204
  | 205 // TEXT_NOT_FOUND_205
  | 206 // BAD_ARGS_206
  | 207 // CONTENT_MISSING_207
  | 208 // TITLE_NOT_FOUND_208
  | 209 // SERVICE_ERROR_209
  | 210 // TOR_SKIPPED_210
  | 211 // TOR_INCOMPATIBLE_211
  | 230 // HTTP_300_230
  | 240 // HTTP_400_240
  | 260 // HTTP_OTHER_260
  | 270 // EMPTY_JSON_270
  | 301 // DELETED_301
  | 302 // SERVICE_DEAD_302
  | 303 // BAD_SIGNATURE_303
  | 304 // BAD_API_URL_304
  | 305 // UNKNOWN_TYPE_305
  | 306 // NO_HINT_306
  | 307 // BAD_HINT_TEXT_307

export type ProofType =
    0 // NONE_0
  | 1 // KEYBASE_1
  | 2 // TWITTER_2
  | 3 // GITHUB_3
  | 4 // REDDIT_4
  | 5 // COINBASE_5
  | 6 // HACKERNEWS_6
  | 1000 // GENERIC_WEB_SITE_1000
  | 1001 // DNS_1001
  | 100001 // ROOTER_100001

export type Proofs = {
  social: Array<TrackProof>;
  web: Array<WebProof>;
  publicKeys: Array<PublicKey>;
}

export type ProvisionMethod =
    0 // DEVICE_0
  | 1 // PAPER_KEY_1
  | 2 // PASSPHRASE_2
  | 3 // GPG_IMPORT_3
  | 4 // GPG_SIGN_4

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

export type RemoteProof = {
  proofType: ProofType;
  key: string;
  value: string;
  displayMarkup: string;
  sigID: SigID;
  mTime: Time;
}

export type RevokedKey = {
  key: PublicKey;
  time: KeybaseTime;
}

export type SaltpackDecryptOptions = {
  interactive: boolean;
  forceRemoteCheck: boolean;
}

export type SaltpackEncryptOptions = {
  recipients: Array<string>;
  hideSelf: boolean;
  noSelfEncrypt: boolean;
  binary: boolean;
  hideRecipients: boolean;
}

export type SaltpackEncryptedMessageInfo = {
  devices: Array<Device>;
  numAnonReceivers: int;
  receiverIsAnon: boolean;
}

export type SaltpackSender = {
  uid: UID;
  username: string;
  senderType: SaltpackSenderType;
}

export type SaltpackSenderType =
    0 // NOT_TRACKED_0
  | 1 // UNKNOWN_1
  | 2 // ANONYMOUS_2
  | 3 // TRACKING_BROKE_3
  | 4 // TRACKING_OK_4
  | 5 // SELF_5

export type SaltpackSignOptions = {
  detached: boolean;
  binary: boolean;
}

export type SaltpackVerifyOptions = {
  signedBy: string;
  signature: bytes;
}

export type SearchComponent = {
  key: string;
  value: string;
  score: double;
}

export type SearchResult = {
  uid: UID;
  username: string;
  components: Array<SearchComponent>;
  score: double;
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

export type SecretEntryRes = {
  text: string;
  canceled: boolean;
  storeSecret: boolean;
}

export type SecretKeys = {
  signing: NaclSigningKeyPrivate;
  encryption: NaclDHKeyPrivate;
}

export type SecretKeys_getSecretKeys_result = SecretKeys

export type SecretKeys_getSecretKeys_rpc = {
  method: 'SecretKeys.getSecretKeys',
  param: {},
  incomingCallMap: ?incomingCallMapType,
  callback: (null | (err: ?any, response: SecretKeys_getSecretKeys_result) => void)
}

export type SecretResponse = {
  secret: bytes;
  phrase: string;
}

export type SelectKeyRes = {
  keyID: string;
  doSecretPush: boolean;
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

export type ServicesStatus = {
  service: Array<ServiceStatus>;
  kbfs: Array<ServiceStatus>;
}

export type Session = {
  uid: UID;
  username: string;
  token: string;
  deviceSubkeyKid: KID;
  deviceSibkeyKid: KID;
}

export type SessionStatus = {
  SessionFor: string;
  Loaded: boolean;
  Cleared: boolean;
  SaltOnly: boolean;
  Expired: boolean;
}

export type SessionToken = string

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

export type SigHint = {
  remoteId: string;
  humanUrl: string;
  apiUrl: string;
  checkText: string;
}

export type SigID = string

export type SigListArgs = {
  sessionID: int;
  username: string;
  allKeys: boolean;
  types?: ?SigTypes;
  filterx: string;
  verbose: boolean;
  revoked: boolean;
}

export type SigTypes = {
  track: boolean;
  proof: boolean;
  cryptocurrency: boolean;
  isSelf: boolean;
}

export type SignMode =
    0 // ATTACHED_0
  | 1 // DETACHED_1
  | 2 // CLEAR_2

export type SignupRes = {
  passphraseOk: boolean;
  postOk: boolean;
  writeOk: boolean;
}

export type StartProofResult = {
  sigID: SigID;
}

export type Status = {
  code: int;
  name: string;
  desc: string;
  fields: Array<StringKVPair>;
}

export type StatusCode =
    0 // SCOk_0
  | 201 // SCLoginRequired_201
  | 202 // SCBadSession_202
  | 203 // SCBadLoginUserNotFound_203
  | 204 // SCBadLoginPassword_204
  | 205 // SCNotFound_205
  | 218 // SCGeneric_218
  | 235 // SCAlreadyLoggedIn_235
  | 237 // SCCanceled_237
  | 239 // SCInputCanceled_239
  | 274 // SCReloginRequired_274
  | 275 // SCResolutionFailed_275
  | 276 // SCProfileNotPublic_276
  | 277 // SCIdentifyFailed_277
  | 278 // SCTrackingBroke_278
  | 279 // SCWrongCryptoFormat_279
  | 701 // SCBadSignupUsernameTaken_701
  | 707 // SCBadInvitationCode_707
  | 801 // SCMissingResult_801
  | 901 // SCKeyNotFound_901
  | 907 // SCKeyInUse_907
  | 913 // SCKeyBadGen_913
  | 914 // SCKeyNoSecret_914
  | 915 // SCKeyBadUIDs_915
  | 916 // SCKeyNoActive_916
  | 917 // SCKeyNoSig_917
  | 918 // SCKeyBadSig_918
  | 919 // SCKeyBadEldest_919
  | 920 // SCKeyNoEldest_920
  | 921 // SCKeyDuplicateUpdate_921
  | 922 // SCSibkeyAlreadyExists_922
  | 924 // SCDecryptionKeyNotFound_924
  | 927 // SCKeyNoPGPEncryption_927
  | 928 // SCKeyNoNaClEncryption_928
  | 929 // SCKeySyncedPGPNotFound_929
  | 930 // SCKeyNoMatchingGPG_930
  | 1301 // SCBadTrackSession_1301
  | 1409 // SCDeviceNotFound_1409
  | 1410 // SCDeviceMismatch_1410
  | 1411 // SCDeviceRequired_1411
  | 1413 // SCDevicePrevProvisioned_1413
  | 1414 // SCDeviceNoProvision_1414
  | 1501 // SCStreamExists_1501
  | 1502 // SCStreamNotFound_1502
  | 1503 // SCStreamWrongKind_1503
  | 1504 // SCStreamEOF_1504
  | 1601 // SCAPINetworkError_1601
  | 1602 // SCTimeout_1602
  | 1701 // SCProofError_1701
  | 1702 // SCIdentificationExpired_1702
  | 1703 // SCSelfNotFound_1703
  | 1704 // SCBadKexPhrase_1704
  | 1705 // SCNoUIDelegation_1705
  | 1706 // SCNoUI_1706
  | 1800 // SCInvalidVersionError_1800
  | 1801 // SCOldVersionError_1801
  | 1802 // SCInvalidLocationError_1802
  | 1803 // SCServiceStatusError_1803
  | 1804 // SCInstallError_1804

export type Stream = {
  fd: int;
}

export type StringKVPair = {
  key: string;
  value: string;
}

export type Test = {
  reply: string;
}

export type Text = {
  data: string;
  markup: boolean;
}

export type Time = long

export type TrackDiff = {
  type: TrackDiffType;
  displayMarkup: string;
}

export type TrackDiffType =
    0 // NONE_0
  | 1 // ERROR_1
  | 2 // CLASH_2
  | 3 // REVOKED_3
  | 4 // UPGRADED_4
  | 5 // NEW_5
  | 6 // REMOTE_FAIL_6
  | 7 // REMOTE_WORKING_7
  | 8 // REMOTE_CHANGED_8
  | 9 // NEW_ELDEST_9
  | 10 // NONE_VIA_TEMPORARY_10

export type TrackOptions = {
  localOnly: boolean;
  bypassConfirm: boolean;
  forceRetrack: boolean;
  expiringLocal: boolean;
}

export type TrackProof = {
  proofType: string;
  proofName: string;
  idString: string;
}

export type TrackStatus =
    1 // NEW_OK_1
  | 2 // NEW_ZERO_PROOFS_2
  | 3 // NEW_FAIL_PROOFS_3
  | 4 // UPDATE_BROKEN_4
  | 5 // UPDATE_NEW_PROOFS_5
  | 6 // UPDATE_OK_6

export type TrackSummary = {
  username: string;
  time: Time;
  isRemote: boolean;
}

export type TrackToken = string

export type Tracker = {
  tracker: UID;
  status: int;
  mTime: Time;
}

export type UID = string

export type UnboxAnyRes = {
  kid: KID;
  plaintext: Bytes32;
  index: int;
}

export type UninstallResult = {
  componentResults: Array<ComponentResult>;
  status: Status;
}

export type Update = {
  version: string;
  name: string;
  description: string;
  instructions?: ?string;
  type: UpdateType;
  publishedAt?: ?Time;
  asset?: ?Asset;
}

export type UpdateAction =
    0 // UPDATE_0
  | 1 // SKIP_1
  | 2 // SNOOZE_2
  | 3 // CANCEL_3

export type UpdateAppInUseAction =
    0 // CANCEL_0
  | 1 // FORCE_1
  | 2 // SNOOZE_2
  | 3 // KILL_PROCESSES_3

export type UpdateAppInUseRes = {
  action: UpdateAppInUseAction;
}

export type UpdateOptions = {
  version: string;
  platform: string;
  destinationPath: string;
  source: string;
  URL: string;
  channel: string;
  force: boolean;
  defaultInstructions: string;
  signaturePath: string;
}

export type UpdatePromptOptions = {
  alwaysAutoInstall: boolean;
}

export type UpdatePromptRes = {
  action: UpdateAction;
  alwaysAutoInstall: boolean;
  snoozeUntil: Time;
}

export type UpdateQuitRes = {
  quit: boolean;
  pid: int;
  applicationPath: string;
}

export type UpdateResult = {
  update?: ?Update;
}

export type UpdateType =
    0 // NORMAL_0
  | 1 // BUGFIX_1
  | 2 // CRITICAL_2

export type User = {
  uid: UID;
  username: string;
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

export type UserPlusKeys = {
  uid: UID;
  username: string;
  deviceKeys: Array<PublicKey>;
  revokedDeviceKeys: Array<RevokedKey>;
  pgpKeyCount: int;
  uvv: UserVersionVector;
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

export type UserVersionVector = {
  id: long;
  sigHints: int;
  sigChain: long;
  cachedAt: Time;
  lastIdentifiedAt: Time;
}

export type VerifySessionRes = {
  uid: UID;
  sid: string;
  generated: int;
  lifetime: int;
}

export type WebProof = {
  hostname: string;
  protocols: Array<string>;
}

export type account_passphraseChange_result = void

export type account_passphraseChange_rpc = {
  method: 'account.passphraseChange',
  param: {
    oldPassphrase: string,
    passphrase: string,
    force: boolean
  },
  incomingCallMap: ?incomingCallMapType,
  callback: (null | (err: ?any) => void)
}

export type account_passphrasePrompt_result = GetPassphraseRes

export type account_passphrasePrompt_rpc = {
  method: 'account.passphrasePrompt',
  param: {
    guiArg: GUIEntryArg
  },
  incomingCallMap: ?incomingCallMapType,
  callback: (null | (err: ?any, response: account_passphrasePrompt_result) => void)
}

export type block_addReference_result = void

export type block_addReference_rpc = {
  method: 'block.addReference',
  param: {
    folder: string,
    ref: BlockReference
  },
  incomingCallMap: ?incomingCallMapType,
  callback: (null | (err: ?any) => void)
}

export type block_archiveReference_result = Array<BlockReference>

export type block_archiveReference_rpc = {
  method: 'block.archiveReference',
  param: {
    folder: string,
    refs: Array<BlockReference>
  },
  incomingCallMap: ?incomingCallMapType,
  callback: (null | (err: ?any, response: block_archiveReference_result) => void)
}

export type block_authenticateSession_result = void

export type block_authenticateSession_rpc = {
  method: 'block.authenticateSession',
  param: {
    signature: string
  },
  incomingCallMap: ?incomingCallMapType,
  callback: (null | (err: ?any) => void)
}

export type block_delReference_result = void

export type block_delReference_rpc = {
  method: 'block.delReference',
  param: {
    folder: string,
    ref: BlockReference
  },
  incomingCallMap: ?incomingCallMapType,
  callback: (null | (err: ?any) => void)
}

export type block_getBlock_result = GetBlockRes

export type block_getBlock_rpc = {
  method: 'block.getBlock',
  param: {
    bid: BlockIdCombo,
    folder: string
  },
  incomingCallMap: ?incomingCallMapType,
  callback: (null | (err: ?any, response: block_getBlock_result) => void)
}

export type block_getSessionChallenge_result = ChallengeInfo

export type block_getSessionChallenge_rpc = {
  method: 'block.getSessionChallenge',
  param: {},
  incomingCallMap: ?incomingCallMapType,
  callback: (null | (err: ?any, response: block_getSessionChallenge_result) => void)
}

export type block_getUserQuotaInfo_result = bytes

export type block_getUserQuotaInfo_rpc = {
  method: 'block.getUserQuotaInfo',
  param: {},
  incomingCallMap: ?incomingCallMapType,
  callback: (null | (err: ?any, response: block_getUserQuotaInfo_result) => void)
}

export type block_putBlock_result = void

export type block_putBlock_rpc = {
  method: 'block.putBlock',
  param: {
    bid: BlockIdCombo,
    folder: string,
    blockKey: string,
    buf: bytes
  },
  incomingCallMap: ?incomingCallMapType,
  callback: (null | (err: ?any) => void)
}

export type config_clearValue_result = void

export type config_clearValue_rpc = {
  method: 'config.clearValue',
  param: {
    path: string
  },
  incomingCallMap: ?incomingCallMapType,
  callback: (null | (err: ?any) => void)
}

export type config_getConfig_result = Config

export type config_getConfig_rpc = {
  method: 'config.getConfig',
  param: {},
  incomingCallMap: ?incomingCallMapType,
  callback: (null | (err: ?any, response: config_getConfig_result) => void)
}

export type config_getCurrentStatus_result = GetCurrentStatusRes

export type config_getCurrentStatus_rpc = {
  method: 'config.getCurrentStatus',
  param: {},
  incomingCallMap: ?incomingCallMapType,
  callback: (null | (err: ?any, response: config_getCurrentStatus_result) => void)
}

export type config_getExtendedStatus_result = ExtendedStatus

export type config_getExtendedStatus_rpc = {
  method: 'config.getExtendedStatus',
  param: {},
  incomingCallMap: ?incomingCallMapType,
  callback: (null | (err: ?any, response: config_getExtendedStatus_result) => void)
}

export type config_getValue_result = ConfigValue

export type config_getValue_rpc = {
  method: 'config.getValue',
  param: {
    path: string
  },
  incomingCallMap: ?incomingCallMapType,
  callback: (null | (err: ?any, response: config_getValue_result) => void)
}

export type config_helloIAm_result = void

export type config_helloIAm_rpc = {
  method: 'config.helloIAm',
  param: {
    details: ClientDetails
  },
  incomingCallMap: ?incomingCallMapType,
  callback: (null | (err: ?any) => void)
}

export type config_setPath_result = void

export type config_setPath_rpc = {
  method: 'config.setPath',
  param: {
    path: string
  },
  incomingCallMap: ?incomingCallMapType,
  callback: (null | (err: ?any) => void)
}

export type config_setUserConfig_result = void

export type config_setUserConfig_rpc = {
  method: 'config.setUserConfig',
  param: {
    username: string,
    key: string,
    value: string
  },
  incomingCallMap: ?incomingCallMapType,
  callback: (null | (err: ?any) => void)
}

export type config_setValue_result = void

export type config_setValue_rpc = {
  method: 'config.setValue',
  param: {
    path: string,
    value: ConfigValue
  },
  incomingCallMap: ?incomingCallMapType,
  callback: (null | (err: ?any) => void)
}

export type crypto_signED25519_result = ED25519SignatureInfo

export type crypto_signED25519_rpc = {
  method: 'crypto.signED25519',
  param: {
    msg: bytes,
    reason: string
  },
  incomingCallMap: ?incomingCallMapType,
  callback: (null | (err: ?any, response: crypto_signED25519_result) => void)
}

export type crypto_signToString_result = string

export type crypto_signToString_rpc = {
  method: 'crypto.signToString',
  param: {
    msg: bytes,
    reason: string
  },
  incomingCallMap: ?incomingCallMapType,
  callback: (null | (err: ?any, response: crypto_signToString_result) => void)
}

export type crypto_unboxBytes32Any_result = UnboxAnyRes

export type crypto_unboxBytes32Any_rpc = {
  method: 'crypto.unboxBytes32Any',
  param: {
    bundles: Array<CiphertextBundle>,
    reason: string,
    promptPaper: boolean
  },
  incomingCallMap: ?incomingCallMapType,
  callback: (null | (err: ?any, response: crypto_unboxBytes32Any_result) => void)
}

export type crypto_unboxBytes32_result = Bytes32

export type crypto_unboxBytes32_rpc = {
  method: 'crypto.unboxBytes32',
  param: {
    encryptedBytes32: EncryptedBytes32,
    nonce: BoxNonce,
    peersPublicKey: BoxPublicKey,
    reason: string
  },
  incomingCallMap: ?incomingCallMapType,
  callback: (null | (err: ?any, response: crypto_unboxBytes32_result) => void)
}

export type ctl_dbNuke_result = void

export type ctl_dbNuke_rpc = {
  method: 'ctl.dbNuke',
  param: {},
  incomingCallMap: ?incomingCallMapType,
  callback: (null | (err: ?any) => void)
}

export type ctl_logRotate_result = void

export type ctl_logRotate_rpc = {
  method: 'ctl.logRotate',
  param: {},
  incomingCallMap: ?incomingCallMapType,
  callback: (null | (err: ?any) => void)
}

export type ctl_reload_result = void

export type ctl_reload_rpc = {
  method: 'ctl.reload',
  param: {},
  incomingCallMap: ?incomingCallMapType,
  callback: (null | (err: ?any) => void)
}

export type ctl_stop_result = void

export type ctl_stop_rpc = {
  method: 'ctl.stop',
  param: {
    exitCode: ExitCode
  },
  incomingCallMap: ?incomingCallMapType,
  callback: (null | (err: ?any) => void)
}

export type debugging_firstStep_result = FirstStepResult

export type debugging_firstStep_rpc = {
  method: 'debugging.firstStep',
  param: {
    val: int
  },
  incomingCallMap: ?incomingCallMapType,
  callback: (null | (err: ?any, response: debugging_firstStep_result) => void)
}

export type debugging_increment_result = int

export type debugging_increment_rpc = {
  method: 'debugging.increment',
  param: {
    val: int
  },
  incomingCallMap: ?incomingCallMapType,
  callback: (null | (err: ?any, response: debugging_increment_result) => void)
}

export type debugging_secondStep_result = int

export type debugging_secondStep_rpc = {
  method: 'debugging.secondStep',
  param: {
    val: int
  },
  incomingCallMap: ?incomingCallMapType,
  callback: (null | (err: ?any, response: debugging_secondStep_result) => void)
}

export type delegateUiCtl_registerIdentifyUI_result = void

export type delegateUiCtl_registerIdentifyUI_rpc = {
  method: 'delegateUiCtl.registerIdentifyUI',
  param: {},
  incomingCallMap: ?incomingCallMapType,
  callback: (null | (err: ?any) => void)
}

export type delegateUiCtl_registerSecretUI_result = void

export type delegateUiCtl_registerSecretUI_rpc = {
  method: 'delegateUiCtl.registerSecretUI',
  param: {},
  incomingCallMap: ?incomingCallMapType,
  callback: (null | (err: ?any) => void)
}

export type delegateUiCtl_registerUpdateUI_result = void

export type delegateUiCtl_registerUpdateUI_rpc = {
  method: 'delegateUiCtl.registerUpdateUI',
  param: {},
  incomingCallMap: ?incomingCallMapType,
  callback: (null | (err: ?any) => void)
}

export type device_deviceAdd_result = void

export type device_deviceAdd_rpc = {
  method: 'device.deviceAdd',
  param: {},
  incomingCallMap: ?incomingCallMapType,
  callback: (null | (err: ?any) => void)
}

export type device_deviceList_result = Array<Device>

export type device_deviceList_rpc = {
  method: 'device.deviceList',
  param: {},
  incomingCallMap: ?incomingCallMapType,
  callback: (null | (err: ?any, response: device_deviceList_result) => void)
}

export type favorite_favoriteAdd_result = void

export type favorite_favoriteAdd_rpc = {
  method: 'favorite.favoriteAdd',
  param: {
    folder: Folder
  },
  incomingCallMap: ?incomingCallMapType,
  callback: (null | (err: ?any) => void)
}

export type favorite_favoriteDelete_result = void

export type favorite_favoriteDelete_rpc = {
  method: 'favorite.favoriteDelete',
  param: {
    folder: Folder
  },
  incomingCallMap: ?incomingCallMapType,
  callback: (null | (err: ?any) => void)
}

export type favorite_favoriteList_result = Array<Folder>

export type favorite_favoriteList_rpc = {
  method: 'favorite.favoriteList',
  param: {},
  incomingCallMap: ?incomingCallMapType,
  callback: (null | (err: ?any, response: favorite_favoriteList_result) => void)
}

export type gpgUi_confirmDuplicateKeyChosen_result = boolean

export type gpgUi_confirmDuplicateKeyChosen_rpc = {
  method: 'gpgUi.confirmDuplicateKeyChosen',
  param: {},
  incomingCallMap: ?incomingCallMapType,
  callback: (null | (err: ?any, response: gpgUi_confirmDuplicateKeyChosen_result) => void)
}

export type gpgUi_selectKeyAndPushOption_result = SelectKeyRes

export type gpgUi_selectKeyAndPushOption_rpc = {
  method: 'gpgUi.selectKeyAndPushOption',
  param: {
    keys: Array<GPGKey>
  },
  incomingCallMap: ?incomingCallMapType,
  callback: (null | (err: ?any, response: gpgUi_selectKeyAndPushOption_result) => void)
}

export type gpgUi_selectKey_result = string

export type gpgUi_selectKey_rpc = {
  method: 'gpgUi.selectKey',
  param: {
    keys: Array<GPGKey>
  },
  incomingCallMap: ?incomingCallMapType,
  callback: (null | (err: ?any, response: gpgUi_selectKey_result) => void)
}

export type gpgUi_sign_result = string

export type gpgUi_sign_rpc = {
  method: 'gpgUi.sign',
  param: {
    msg: bytes,
    fingerprint: bytes
  },
  incomingCallMap: ?incomingCallMapType,
  callback: (null | (err: ?any, response: gpgUi_sign_result) => void)
}

export type gpgUi_wantToAddGPGKey_result = boolean

export type gpgUi_wantToAddGPGKey_rpc = {
  method: 'gpgUi.wantToAddGPGKey',
  param: {},
  incomingCallMap: ?incomingCallMapType,
  callback: (null | (err: ?any, response: gpgUi_wantToAddGPGKey_result) => void)
}

export type identifyUi_confirm_result = ConfirmResult

export type identifyUi_confirm_rpc = {
  method: 'identifyUi.confirm',
  param: {
    outcome: IdentifyOutcome
  },
  incomingCallMap: ?incomingCallMapType,
  callback: (null | (err: ?any, response: identifyUi_confirm_result) => void)
}

export type identifyUi_delegateIdentifyUI_result = int

export type identifyUi_delegateIdentifyUI_rpc = {
  method: 'identifyUi.delegateIdentifyUI',
  param: {},
  incomingCallMap: ?incomingCallMapType,
  callback: (null | (err: ?any, response: identifyUi_delegateIdentifyUI_result) => void)
}

export type identifyUi_displayCryptocurrency_result = void

export type identifyUi_displayCryptocurrency_rpc = {
  method: 'identifyUi.displayCryptocurrency',
  param: {
    c: Cryptocurrency
  },
  incomingCallMap: ?incomingCallMapType,
  callback: (null | (err: ?any) => void)
}

export type identifyUi_displayKey_result = void

export type identifyUi_displayKey_rpc = {
  method: 'identifyUi.displayKey',
  param: {
    key: IdentifyKey
  },
  incomingCallMap: ?incomingCallMapType,
  callback: (null | (err: ?any) => void)
}

export type identifyUi_displayTrackStatement_result = void

export type identifyUi_displayTrackStatement_rpc = {
  method: 'identifyUi.displayTrackStatement',
  param: {
    stmt: string
  },
  incomingCallMap: ?incomingCallMapType,
  callback: (null | (err: ?any) => void)
}

export type identifyUi_displayUserCard_result = void

export type identifyUi_displayUserCard_rpc = {
  method: 'identifyUi.displayUserCard',
  param: {
    card: UserCard
  },
  incomingCallMap: ?incomingCallMapType,
  callback: (null | (err: ?any) => void)
}

export type identifyUi_finishSocialProofCheck_result = void

export type identifyUi_finishSocialProofCheck_rpc = {
  method: 'identifyUi.finishSocialProofCheck',
  param: {
    rp: RemoteProof,
    lcr: LinkCheckResult
  },
  incomingCallMap: ?incomingCallMapType,
  callback: (null | (err: ?any) => void)
}

export type identifyUi_finishWebProofCheck_result = void

export type identifyUi_finishWebProofCheck_rpc = {
  method: 'identifyUi.finishWebProofCheck',
  param: {
    rp: RemoteProof,
    lcr: LinkCheckResult
  },
  incomingCallMap: ?incomingCallMapType,
  callback: (null | (err: ?any) => void)
}

export type identifyUi_finish_result = void

export type identifyUi_finish_rpc = {
  method: 'identifyUi.finish',
  param: {},
  incomingCallMap: ?incomingCallMapType,
  callback: (null | (err: ?any) => void)
}

export type identifyUi_launchNetworkChecks_result = void

export type identifyUi_launchNetworkChecks_rpc = {
  method: 'identifyUi.launchNetworkChecks',
  param: {
    identity: Identity,
    user: User
  },
  incomingCallMap: ?incomingCallMapType,
  callback: (null | (err: ?any) => void)
}

export type identifyUi_reportLastTrack_result = void

export type identifyUi_reportLastTrack_rpc = {
  method: 'identifyUi.reportLastTrack',
  param: {
    track: (null | TrackSummary)
  },
  incomingCallMap: ?incomingCallMapType,
  callback: (null | (err: ?any) => void)
}

export type identifyUi_reportTrackToken_result = void

export type identifyUi_reportTrackToken_rpc = {
  method: 'identifyUi.reportTrackToken',
  param: {
    trackToken: TrackToken
  },
  incomingCallMap: ?incomingCallMapType,
  callback: (null | (err: ?any) => void)
}

export type identifyUi_start_result = void

export type identifyUi_start_rpc = {
  method: 'identifyUi.start',
  param: {
    username: string,
    reason: IdentifyReason
  },
  incomingCallMap: ?incomingCallMapType,
  callback: (null | (err: ?any) => void)
}

export type identify_Resolve2_result = User

export type identify_Resolve2_rpc = {
  method: 'identify.Resolve2',
  param: {
    assertion: string
  },
  incomingCallMap: ?incomingCallMapType,
  callback: (null | (err: ?any, response: identify_Resolve2_result) => void)
}

export type identify_Resolve_result = UID

export type identify_Resolve_rpc = {
  method: 'identify.Resolve',
  param: {
    assertion: string
  },
  incomingCallMap: ?incomingCallMapType,
  callback: (null | (err: ?any, response: identify_Resolve_result) => void)
}

export type identify_identify2_result = Identify2Res

export type identify_identify2_rpc = {
  method: 'identify.identify2',
  param: {
    uid: UID,
    userAssertion: string,
    reason: IdentifyReason,
    useDelegateUI: boolean,
    alwaysBlock: boolean,
    noErrorOnTrackFailure: boolean,
    forceRemoteCheck: boolean,
    needProofSet: boolean
  },
  incomingCallMap: ?incomingCallMapType,
  callback: (null | (err: ?any, response: identify_identify2_result) => void)
}

export type identify_identify_result = IdentifyRes

export type identify_identify_rpc = {
  method: 'identify.identify',
  param: {
    userAssertion: string,
    trackStatement: boolean,
    forceRemoteCheck: boolean,
    useDelegateUI: boolean,
    reason: IdentifyReason,
    source: ClientType
  },
  incomingCallMap: ?incomingCallMapType,
  callback: (null | (err: ?any, response: identify_identify_result) => void)
}

export type kbfs_FSEvent_result = void

export type kbfs_FSEvent_rpc = {
  method: 'kbfs.FSEvent',
  param: {
    event: FSNotification
  },
  incomingCallMap: ?incomingCallMapType,
  callback: (null | (err: ?any) => void)
}

export type logUi_log_result = void

export type logUi_log_rpc = {
  method: 'logUi.log',
  param: {
    level: LogLevel,
    text: Text
  },
  incomingCallMap: ?incomingCallMapType,
  callback: (null | (err: ?any) => void)
}

export type log_registerLogger_result = void

export type log_registerLogger_rpc = {
  method: 'log.registerLogger',
  param: {
    name: string,
    level: LogLevel
  },
  incomingCallMap: ?incomingCallMapType,
  callback: (null | (err: ?any) => void)
}

export type loginUi_displayPaperKeyPhrase_result = void

export type loginUi_displayPaperKeyPhrase_rpc = {
  method: 'loginUi.displayPaperKeyPhrase',
  param: {
    phrase: string
  },
  incomingCallMap: ?incomingCallMapType,
  callback: (null | (err: ?any) => void)
}

export type loginUi_displayPrimaryPaperKey_result = void

export type loginUi_displayPrimaryPaperKey_rpc = {
  method: 'loginUi.displayPrimaryPaperKey',
  param: {
    phrase: string
  },
  incomingCallMap: ?incomingCallMapType,
  callback: (null | (err: ?any) => void)
}

export type loginUi_getEmailOrUsername_result = string

export type loginUi_getEmailOrUsername_rpc = {
  method: 'loginUi.getEmailOrUsername',
  param: {},
  incomingCallMap: ?incomingCallMapType,
  callback: (null | (err: ?any, response: loginUi_getEmailOrUsername_result) => void)
}

export type loginUi_promptRevokePaperKeys_result = boolean

export type loginUi_promptRevokePaperKeys_rpc = {
  method: 'loginUi.promptRevokePaperKeys',
  param: {
    device: Device,
    index: int
  },
  incomingCallMap: ?incomingCallMapType,
  callback: (null | (err: ?any, response: loginUi_promptRevokePaperKeys_result) => void)
}

export type login_clearStoredSecret_result = void

export type login_clearStoredSecret_rpc = {
  method: 'login.clearStoredSecret',
  param: {
    username: string
  },
  incomingCallMap: ?incomingCallMapType,
  callback: (null | (err: ?any) => void)
}

export type login_deprovision_result = void

export type login_deprovision_rpc = {
  method: 'login.deprovision',
  param: {
    username: string,
    doRevoke: boolean
  },
  incomingCallMap: ?incomingCallMapType,
  callback: (null | (err: ?any) => void)
}

export type login_getConfiguredAccounts_result = Array<ConfiguredAccount>

export type login_getConfiguredAccounts_rpc = {
  method: 'login.getConfiguredAccounts',
  param: {},
  incomingCallMap: ?incomingCallMapType,
  callback: (null | (err: ?any, response: login_getConfiguredAccounts_result) => void)
}

export type login_login_result = void

export type login_login_rpc = {
  method: 'login.login',
  param: {
    deviceType: string,
    usernameOrEmail: string,
    clientType: ClientType
  },
  incomingCallMap: ?incomingCallMapType,
  callback: (null | (err: ?any) => void)
}

export type login_logout_result = void

export type login_logout_rpc = {
  method: 'login.logout',
  param: {},
  incomingCallMap: ?incomingCallMapType,
  callback: (null | (err: ?any) => void)
}

export type login_paperKey_result = void

export type login_paperKey_rpc = {
  method: 'login.paperKey',
  param: {},
  incomingCallMap: ?incomingCallMapType,
  callback: (null | (err: ?any) => void)
}

export type login_recoverAccountFromEmailAddress_result = void

export type login_recoverAccountFromEmailAddress_rpc = {
  method: 'login.recoverAccountFromEmailAddress',
  param: {
    email: string
  },
  incomingCallMap: ?incomingCallMapType,
  callback: (null | (err: ?any) => void)
}

export type login_unlockWithPassphrase_result = void

export type login_unlockWithPassphrase_rpc = {
  method: 'login.unlockWithPassphrase',
  param: {
    passphrase: string
  },
  incomingCallMap: ?incomingCallMapType,
  callback: (null | (err: ?any) => void)
}

export type login_unlock_result = void

export type login_unlock_rpc = {
  method: 'login.unlock',
  param: {},
  incomingCallMap: ?incomingCallMapType,
  callback: (null | (err: ?any) => void)
}

export type metadataUpdate_folderNeedsRekey_result = void

export type metadataUpdate_folderNeedsRekey_rpc = {
  method: 'metadataUpdate.folderNeedsRekey',
  param: {
    folderID: string,
    revision: long
  },
  incomingCallMap: ?incomingCallMapType,
  callback: (null | (err: ?any) => void)
}

export type metadataUpdate_metadataUpdate_result = void

export type metadataUpdate_metadataUpdate_rpc = {
  method: 'metadataUpdate.metadataUpdate',
  param: {
    folderID: string,
    revision: long
  },
  incomingCallMap: ?incomingCallMapType,
  callback: (null | (err: ?any) => void)
}

export type metadata_authenticate_result = int

export type metadata_authenticate_rpc = {
  method: 'metadata.authenticate',
  param: {
    signature: string
  },
  incomingCallMap: ?incomingCallMapType,
  callback: (null | (err: ?any, response: metadata_authenticate_result) => void)
}

export type metadata_deleteKey_result = void

export type metadata_deleteKey_rpc = {
  method: 'metadata.deleteKey',
  param: {
    uid: UID,
    deviceKID: KID,
    keyHalfID: bytes,
    logTags: {string: string}
  },
  incomingCallMap: ?incomingCallMapType,
  callback: (null | (err: ?any) => void)
}

export type metadata_getChallenge_result = ChallengeInfo

export type metadata_getChallenge_rpc = {
  method: 'metadata.getChallenge',
  param: {},
  incomingCallMap: ?incomingCallMapType,
  callback: (null | (err: ?any, response: metadata_getChallenge_result) => void)
}

export type metadata_getFolderHandle_result = bytes

export type metadata_getFolderHandle_rpc = {
  method: 'metadata.getFolderHandle',
  param: {
    folderID: string,
    signature: string,
    challenge: string
  },
  incomingCallMap: ?incomingCallMapType,
  callback: (null | (err: ?any, response: metadata_getFolderHandle_result) => void)
}

export type metadata_getFoldersForRekey_result = void

export type metadata_getFoldersForRekey_rpc = {
  method: 'metadata.getFoldersForRekey',
  param: {
    deviceKID: KID
  },
  incomingCallMap: ?incomingCallMapType,
  callback: (null | (err: ?any) => void)
}

export type metadata_getKey_result = bytes

export type metadata_getKey_rpc = {
  method: 'metadata.getKey',
  param: {
    keyHalfID: bytes,
    deviceKID: string,
    logTags: {string: string}
  },
  incomingCallMap: ?incomingCallMapType,
  callback: (null | (err: ?any, response: metadata_getKey_result) => void)
}

export type metadata_getMerkleNode_result = bytes

export type metadata_getMerkleNode_rpc = {
  method: 'metadata.getMerkleNode',
  param: {
    hash: string
  },
  incomingCallMap: ?incomingCallMapType,
  callback: (null | (err: ?any, response: metadata_getMerkleNode_result) => void)
}

export type metadata_getMerkleRootLatest_result = MerkleRoot

export type metadata_getMerkleRootLatest_rpc = {
  method: 'metadata.getMerkleRootLatest',
  param: {
    treeID: MerkleTreeID
  },
  incomingCallMap: ?incomingCallMapType,
  callback: (null | (err: ?any, response: metadata_getMerkleRootLatest_result) => void)
}

export type metadata_getMerkleRootSince_result = MerkleRoot

export type metadata_getMerkleRootSince_rpc = {
  method: 'metadata.getMerkleRootSince',
  param: {
    treeID: MerkleTreeID,
    when: Time
  },
  incomingCallMap: ?incomingCallMapType,
  callback: (null | (err: ?any, response: metadata_getMerkleRootSince_result) => void)
}

export type metadata_getMerkleRoot_result = MerkleRoot

export type metadata_getMerkleRoot_rpc = {
  method: 'metadata.getMerkleRoot',
  param: {
    treeID: MerkleTreeID,
    seqNo: long
  },
  incomingCallMap: ?incomingCallMapType,
  callback: (null | (err: ?any, response: metadata_getMerkleRoot_result) => void)
}

export type metadata_getMetadata_result = MetadataResponse

export type metadata_getMetadata_rpc = {
  method: 'metadata.getMetadata',
  param: {
    folderID: string,
    folderHandle: bytes,
    branchID: string,
    unmerged: boolean,
    startRevision: long,
    stopRevision: long,
    logTags: {string: string}
  },
  incomingCallMap: ?incomingCallMapType,
  callback: (null | (err: ?any, response: metadata_getMetadata_result) => void)
}

export type metadata_ping_result = void

export type metadata_ping_rpc = {
  method: 'metadata.ping',
  param: {},
  incomingCallMap: ?incomingCallMapType,
  callback: (null | (err: ?any) => void)
}

export type metadata_pruneBranch_result = void

export type metadata_pruneBranch_rpc = {
  method: 'metadata.pruneBranch',
  param: {
    folderID: string,
    branchID: string,
    logTags: {string: string}
  },
  incomingCallMap: ?incomingCallMapType,
  callback: (null | (err: ?any) => void)
}

export type metadata_putKeys_result = void

export type metadata_putKeys_rpc = {
  method: 'metadata.putKeys',
  param: {
    keyHalves: Array<KeyHalf>,
    logTags: {string: string}
  },
  incomingCallMap: ?incomingCallMapType,
  callback: (null | (err: ?any) => void)
}

export type metadata_putMetadata_result = void

export type metadata_putMetadata_rpc = {
  method: 'metadata.putMetadata',
  param: {
    mdBlock: MDBlock,
    logTags: {string: string}
  },
  incomingCallMap: ?incomingCallMapType,
  callback: (null | (err: ?any) => void)
}

export type metadata_registerForUpdates_result = void

export type metadata_registerForUpdates_rpc = {
  method: 'metadata.registerForUpdates',
  param: {
    folderID: string,
    currRevision: long,
    logTags: {string: string}
  },
  incomingCallMap: ?incomingCallMapType,
  callback: (null | (err: ?any) => void)
}

export type metadata_truncateLock_result = boolean

export type metadata_truncateLock_rpc = {
  method: 'metadata.truncateLock',
  param: {
    folderID: string
  },
  incomingCallMap: ?incomingCallMapType,
  callback: (null | (err: ?any, response: metadata_truncateLock_result) => void)
}

export type metadata_truncateUnlock_result = boolean

export type metadata_truncateUnlock_rpc = {
  method: 'metadata.truncateUnlock',
  param: {
    folderID: string
  },
  incomingCallMap: ?incomingCallMapType,
  callback: (null | (err: ?any, response: metadata_truncateUnlock_result) => void)
}

export type notifyCtl_setNotifications_result = void

export type notifyCtl_setNotifications_rpc = {
  method: 'notifyCtl.setNotifications',
  param: {
    channels: NotificationChannels
  },
  incomingCallMap: ?incomingCallMapType,
  callback: (null | (err: ?any) => void)
}

export type pgpUi_outputSignatureSuccess_result = void

export type pgpUi_outputSignatureSuccess_rpc = {
  method: 'pgpUi.outputSignatureSuccess',
  param: {
    fingerprint: string,
    username: string,
    signedAt: Time
  },
  incomingCallMap: ?incomingCallMapType,
  callback: (null | (err: ?any) => void)
}

export type pgp_pgpDecrypt_result = PGPSigVerification

export type pgp_pgpDecrypt_rpc = {
  method: 'pgp.pgpDecrypt',
  param: {
    source: Stream,
    sink: Stream,
    opts: PGPDecryptOptions
  },
  incomingCallMap: ?incomingCallMapType,
  callback: (null | (err: ?any, response: pgp_pgpDecrypt_result) => void)
}

export type pgp_pgpDeletePrimary_result = void

export type pgp_pgpDeletePrimary_rpc = {
  method: 'pgp.pgpDeletePrimary',
  param: {},
  incomingCallMap: ?incomingCallMapType,
  callback: (null | (err: ?any) => void)
}

export type pgp_pgpEncrypt_result = void

export type pgp_pgpEncrypt_rpc = {
  method: 'pgp.pgpEncrypt',
  param: {
    source: Stream,
    sink: Stream,
    opts: PGPEncryptOptions
  },
  incomingCallMap: ?incomingCallMapType,
  callback: (null | (err: ?any) => void)
}

export type pgp_pgpExportByFingerprint_result = Array<KeyInfo>

export type pgp_pgpExportByFingerprint_rpc = {
  method: 'pgp.pgpExportByFingerprint',
  param: {
    options: PGPQuery
  },
  incomingCallMap: ?incomingCallMapType,
  callback: (null | (err: ?any, response: pgp_pgpExportByFingerprint_result) => void)
}

export type pgp_pgpExportByKID_result = Array<KeyInfo>

export type pgp_pgpExportByKID_rpc = {
  method: 'pgp.pgpExportByKID',
  param: {
    options: PGPQuery
  },
  incomingCallMap: ?incomingCallMapType,
  callback: (null | (err: ?any, response: pgp_pgpExportByKID_result) => void)
}

export type pgp_pgpExport_result = Array<KeyInfo>

export type pgp_pgpExport_rpc = {
  method: 'pgp.pgpExport',
  param: {
    options: PGPQuery
  },
  incomingCallMap: ?incomingCallMapType,
  callback: (null | (err: ?any, response: pgp_pgpExport_result) => void)
}

export type pgp_pgpImport_result = void

export type pgp_pgpImport_rpc = {
  method: 'pgp.pgpImport',
  param: {
    key: bytes,
    pushSecret: boolean
  },
  incomingCallMap: ?incomingCallMapType,
  callback: (null | (err: ?any) => void)
}

export type pgp_pgpKeyGen_result = void

export type pgp_pgpKeyGen_rpc = {
  method: 'pgp.pgpKeyGen',
  param: {
    primaryBits: int,
    subkeyBits: int,
    createUids: PGPCreateUids,
    allowMulti: boolean,
    doExport: boolean,
    pushSecret: boolean
  },
  incomingCallMap: ?incomingCallMapType,
  callback: (null | (err: ?any) => void)
}

export type pgp_pgpPull_result = void

export type pgp_pgpPull_rpc = {
  method: 'pgp.pgpPull',
  param: {
    userAsserts: Array<string>
  },
  incomingCallMap: ?incomingCallMapType,
  callback: (null | (err: ?any) => void)
}

export type pgp_pgpSelect_result = void

export type pgp_pgpSelect_rpc = {
  method: 'pgp.pgpSelect',
  param: {
    fingerprintQuery: string,
    allowMulti: boolean,
    skipImport: boolean,
    onlyImport: boolean
  },
  incomingCallMap: ?incomingCallMapType,
  callback: (null | (err: ?any) => void)
}

export type pgp_pgpSign_result = void

export type pgp_pgpSign_rpc = {
  method: 'pgp.pgpSign',
  param: {
    source: Stream,
    sink: Stream,
    opts: PGPSignOptions
  },
  incomingCallMap: ?incomingCallMapType,
  callback: (null | (err: ?any) => void)
}

export type pgp_pgpUpdate_result = void

export type pgp_pgpUpdate_rpc = {
  method: 'pgp.pgpUpdate',
  param: {
    all: boolean,
    fingerprints: Array<string>
  },
  incomingCallMap: ?incomingCallMapType,
  callback: (null | (err: ?any) => void)
}

export type pgp_pgpVerify_result = PGPSigVerification

export type pgp_pgpVerify_rpc = {
  method: 'pgp.pgpVerify',
  param: {
    source: Stream,
    opts: PGPVerifyOptions
  },
  incomingCallMap: ?incomingCallMapType,
  callback: (null | (err: ?any, response: pgp_pgpVerify_result) => void)
}

export type proveUi_displayRecheckWarning_result = void

export type proveUi_displayRecheckWarning_rpc = {
  method: 'proveUi.displayRecheckWarning',
  param: {
    text: Text
  },
  incomingCallMap: ?incomingCallMapType,
  callback: (null | (err: ?any) => void)
}

export type proveUi_okToCheck_result = boolean

export type proveUi_okToCheck_rpc = {
  method: 'proveUi.okToCheck',
  param: {
    name: string,
    attempt: int
  },
  incomingCallMap: ?incomingCallMapType,
  callback: (null | (err: ?any, response: proveUi_okToCheck_result) => void)
}

export type proveUi_outputInstructions_result = void

export type proveUi_outputInstructions_rpc = {
  method: 'proveUi.outputInstructions',
  param: {
    instructions: Text,
    proof: string
  },
  incomingCallMap: ?incomingCallMapType,
  callback: (null | (err: ?any) => void)
}

export type proveUi_outputPrechecks_result = void

export type proveUi_outputPrechecks_rpc = {
  method: 'proveUi.outputPrechecks',
  param: {
    text: Text
  },
  incomingCallMap: ?incomingCallMapType,
  callback: (null | (err: ?any) => void)
}

export type proveUi_preProofWarning_result = boolean

export type proveUi_preProofWarning_rpc = {
  method: 'proveUi.preProofWarning',
  param: {
    text: Text
  },
  incomingCallMap: ?incomingCallMapType,
  callback: (null | (err: ?any, response: proveUi_preProofWarning_result) => void)
}

export type proveUi_promptOverwrite_result = boolean

export type proveUi_promptOverwrite_rpc = {
  method: 'proveUi.promptOverwrite',
  param: {
    account: string,
    typ: PromptOverwriteType
  },
  incomingCallMap: ?incomingCallMapType,
  callback: (null | (err: ?any, response: proveUi_promptOverwrite_result) => void)
}

export type proveUi_promptUsername_result = string

export type proveUi_promptUsername_rpc = {
  method: 'proveUi.promptUsername',
  param: {
    prompt: string,
    prevError: (null | Status)
  },
  incomingCallMap: ?incomingCallMapType,
  callback: (null | (err: ?any, response: proveUi_promptUsername_result) => void)
}

export type prove_checkProof_result = CheckProofStatus

export type prove_checkProof_rpc = {
  method: 'prove.checkProof',
  param: {
    sigID: SigID
  },
  incomingCallMap: ?incomingCallMapType,
  callback: (null | (err: ?any, response: prove_checkProof_result) => void)
}

export type prove_startProof_result = StartProofResult

export type prove_startProof_rpc = {
  method: 'prove.startProof',
  param: {
    service: string,
    username: string,
    force: boolean,
    promptPosted: boolean
  },
  incomingCallMap: ?incomingCallMapType,
  callback: (null | (err: ?any, response: prove_startProof_result) => void)
}

export type provisionUi_DisplayAndPromptSecret_result = SecretResponse

export type provisionUi_DisplayAndPromptSecret_rpc = {
  method: 'provisionUi.DisplayAndPromptSecret',
  param: {
    secret: bytes,
    phrase: string,
    otherDeviceType: DeviceType
  },
  incomingCallMap: ?incomingCallMapType,
  callback: (null | (err: ?any, response: provisionUi_DisplayAndPromptSecret_result) => void)
}

export type provisionUi_DisplaySecretExchanged_result = void

export type provisionUi_DisplaySecretExchanged_rpc = {
  method: 'provisionUi.DisplaySecretExchanged',
  param: {},
  incomingCallMap: ?incomingCallMapType,
  callback: (null | (err: ?any) => void)
}

export type provisionUi_PromptNewDeviceName_result = string

export type provisionUi_PromptNewDeviceName_rpc = {
  method: 'provisionUi.PromptNewDeviceName',
  param: {
    existingDevices: Array<string>,
    errorMessage: string
  },
  incomingCallMap: ?incomingCallMapType,
  callback: (null | (err: ?any, response: provisionUi_PromptNewDeviceName_result) => void)
}

export type provisionUi_ProvisioneeSuccess_result = void

export type provisionUi_ProvisioneeSuccess_rpc = {
  method: 'provisionUi.ProvisioneeSuccess',
  param: {
    username: string,
    deviceName: string
  },
  incomingCallMap: ?incomingCallMapType,
  callback: (null | (err: ?any) => void)
}

export type provisionUi_ProvisionerSuccess_result = void

export type provisionUi_ProvisionerSuccess_rpc = {
  method: 'provisionUi.ProvisionerSuccess',
  param: {
    deviceName: string,
    deviceType: string
  },
  incomingCallMap: ?incomingCallMapType,
  callback: (null | (err: ?any) => void)
}

export type provisionUi_chooseDeviceType_result = DeviceType

export type provisionUi_chooseDeviceType_rpc = {
  method: 'provisionUi.chooseDeviceType',
  param: {
    kind: ChooseType
  },
  incomingCallMap: ?incomingCallMapType,
  callback: (null | (err: ?any, response: provisionUi_chooseDeviceType_result) => void)
}

export type provisionUi_chooseDevice_result = DeviceID

export type provisionUi_chooseDevice_rpc = {
  method: 'provisionUi.chooseDevice',
  param: {
    devices: Array<Device>
  },
  incomingCallMap: ?incomingCallMapType,
  callback: (null | (err: ?any, response: provisionUi_chooseDevice_result) => void)
}

export type provisionUi_chooseGPGMethod_result = GPGMethod

export type provisionUi_chooseGPGMethod_rpc = {
  method: 'provisionUi.chooseGPGMethod',
  param: {
    keys: Array<GPGKey>
  },
  incomingCallMap: ?incomingCallMapType,
  callback: (null | (err: ?any, response: provisionUi_chooseGPGMethod_result) => void)
}

export type provisionUi_chooseProvisioningMethod_result = ProvisionMethod

export type provisionUi_chooseProvisioningMethod_rpc = {
  method: 'provisionUi.chooseProvisioningMethod',
  param: {
    gpgOption: boolean
  },
  incomingCallMap: ?incomingCallMapType,
  callback: (null | (err: ?any, response: provisionUi_chooseProvisioningMethod_result) => void)
}

export type provisionUi_switchToGPGSignOK_result = boolean

export type provisionUi_switchToGPGSignOK_rpc = {
  method: 'provisionUi.switchToGPGSignOK',
  param: {
    key: GPGKey,
    importError: string
  },
  incomingCallMap: ?incomingCallMapType,
  callback: (null | (err: ?any, response: provisionUi_switchToGPGSignOK_result) => void)
}

export type quota_verifySession_result = VerifySessionRes

export type quota_verifySession_rpc = {
  method: 'quota.verifySession',
  param: {
    session: string
  },
  incomingCallMap: ?incomingCallMapType,
  callback: (null | (err: ?any, response: quota_verifySession_result) => void)
}

export type revoke_revokeDevice_result = void

export type revoke_revokeDevice_rpc = {
  method: 'revoke.revokeDevice',
  param: {
    deviceID: DeviceID,
    force: boolean
  },
  incomingCallMap: ?incomingCallMapType,
  callback: (null | (err: ?any) => void)
}

export type revoke_revokeKey_result = void

export type revoke_revokeKey_rpc = {
  method: 'revoke.revokeKey',
  param: {
    keyID: KID
  },
  incomingCallMap: ?incomingCallMapType,
  callback: (null | (err: ?any) => void)
}

export type revoke_revokeSigs_result = void

export type revoke_revokeSigs_rpc = {
  method: 'revoke.revokeSigs',
  param: {
    sigIDQueries: Array<string>
  },
  incomingCallMap: ?incomingCallMapType,
  callback: (null | (err: ?any) => void)
}

export type saltpackUi_saltpackPromptForDecrypt_result = void

export type saltpackUi_saltpackPromptForDecrypt_rpc = {
  method: 'saltpackUi.saltpackPromptForDecrypt',
  param: {
    sender: SaltpackSender
  },
  incomingCallMap: ?incomingCallMapType,
  callback: (null | (err: ?any) => void)
}

export type saltpackUi_saltpackVerifySuccess_result = void

export type saltpackUi_saltpackVerifySuccess_rpc = {
  method: 'saltpackUi.saltpackVerifySuccess',
  param: {
    signingKID: KID,
    sender: SaltpackSender
  },
  incomingCallMap: ?incomingCallMapType,
  callback: (null | (err: ?any) => void)
}

export type saltpack_saltpackDecrypt_result = SaltpackEncryptedMessageInfo

export type saltpack_saltpackDecrypt_rpc = {
  method: 'saltpack.saltpackDecrypt',
  param: {
    source: Stream,
    sink: Stream,
    opts: SaltpackDecryptOptions
  },
  incomingCallMap: ?incomingCallMapType,
  callback: (null | (err: ?any, response: saltpack_saltpackDecrypt_result) => void)
}

export type saltpack_saltpackEncrypt_result = void

export type saltpack_saltpackEncrypt_rpc = {
  method: 'saltpack.saltpackEncrypt',
  param: {
    source: Stream,
    sink: Stream,
    opts: SaltpackEncryptOptions
  },
  incomingCallMap: ?incomingCallMapType,
  callback: (null | (err: ?any) => void)
}

export type saltpack_saltpackSign_result = void

export type saltpack_saltpackSign_rpc = {
  method: 'saltpack.saltpackSign',
  param: {
    source: Stream,
    sink: Stream,
    opts: SaltpackSignOptions
  },
  incomingCallMap: ?incomingCallMapType,
  callback: (null | (err: ?any) => void)
}

export type saltpack_saltpackVerify_result = void

export type saltpack_saltpackVerify_rpc = {
  method: 'saltpack.saltpackVerify',
  param: {
    source: Stream,
    sink: Stream,
    opts: SaltpackVerifyOptions
  },
  incomingCallMap: ?incomingCallMapType,
  callback: (null | (err: ?any) => void)
}

export type secretUi_getPassphrase_result = GetPassphraseRes

export type secretUi_getPassphrase_rpc = {
  method: 'secretUi.getPassphrase',
  param: {
    pinentry: GUIEntryArg,
    terminal: (null | SecretEntryArg)
  },
  incomingCallMap: ?incomingCallMapType,
  callback: (null | (err: ?any, response: secretUi_getPassphrase_result) => void)
}

export type session_currentSession_result = Session

export type session_currentSession_rpc = {
  method: 'session.currentSession',
  param: {},
  incomingCallMap: ?incomingCallMapType,
  callback: (null | (err: ?any, response: session_currentSession_result) => void)
}

export type signup_checkInvitationCode_result = void

export type signup_checkInvitationCode_rpc = {
  method: 'signup.checkInvitationCode',
  param: {
    invitationCode: string
  },
  incomingCallMap: ?incomingCallMapType,
  callback: (null | (err: ?any) => void)
}

export type signup_checkUsernameAvailable_result = void

export type signup_checkUsernameAvailable_rpc = {
  method: 'signup.checkUsernameAvailable',
  param: {
    username: string
  },
  incomingCallMap: ?incomingCallMapType,
  callback: (null | (err: ?any) => void)
}

export type signup_inviteRequest_result = void

export type signup_inviteRequest_rpc = {
  method: 'signup.inviteRequest',
  param: {
    email: string,
    fullname: string,
    notes: string
  },
  incomingCallMap: ?incomingCallMapType,
  callback: (null | (err: ?any) => void)
}

export type signup_signup_result = SignupRes

export type signup_signup_rpc = {
  method: 'signup.signup',
  param: {
    email: string,
    inviteCode: string,
    passphrase: string,
    username: string,
    deviceName: string,
    storeSecret: boolean,
    skipMail: boolean
  },
  incomingCallMap: ?incomingCallMapType,
  callback: (null | (err: ?any, response: signup_signup_result) => void)
}

export type sigs_sigListJSON_result = string

export type sigs_sigListJSON_rpc = {
  method: 'sigs.sigListJSON',
  param: {
    arg: SigListArgs
  },
  incomingCallMap: ?incomingCallMapType,
  callback: (null | (err: ?any, response: sigs_sigListJSON_result) => void)
}

export type sigs_sigList_result = Array<Sig>

export type sigs_sigList_rpc = {
  method: 'sigs.sigList',
  param: {
    arg: SigListArgs
  },
  incomingCallMap: ?incomingCallMapType,
  callback: (null | (err: ?any, response: sigs_sigList_result) => void)
}

export type streamUi_close_result = void

export type streamUi_close_rpc = {
  method: 'streamUi.close',
  param: {
    s: Stream
  },
  incomingCallMap: ?incomingCallMapType,
  callback: (null | (err: ?any) => void)
}

export type streamUi_read_result = bytes

export type streamUi_read_rpc = {
  method: 'streamUi.read',
  param: {
    s: Stream,
    sz: int
  },
  incomingCallMap: ?incomingCallMapType,
  callback: (null | (err: ?any, response: streamUi_read_result) => void)
}

export type streamUi_write_result = int

export type streamUi_write_rpc = {
  method: 'streamUi.write',
  param: {
    s: Stream,
    buf: bytes
  },
  incomingCallMap: ?incomingCallMapType,
  callback: (null | (err: ?any, response: streamUi_write_result) => void)
}

export type test_panic_result = void

export type test_panic_rpc = {
  method: 'test.panic',
  param: {
    message: string
  },
  incomingCallMap: ?incomingCallMapType,
  callback: (null | (err: ?any) => void)
}

export type test_testCallback_result = string

export type test_testCallback_rpc = {
  method: 'test.testCallback',
  param: {
    name: string
  },
  incomingCallMap: ?incomingCallMapType,
  callback: (null | (err: ?any, response: test_testCallback_result) => void)
}

export type test_test_result = Test

export type test_test_rpc = {
  method: 'test.test',
  param: {
    name: string
  },
  incomingCallMap: ?incomingCallMapType,
  callback: (null | (err: ?any, response: test_test_result) => void)
}

export type track_checkTracking_result = void

export type track_checkTracking_rpc = {
  method: 'track.checkTracking',
  param: {},
  incomingCallMap: ?incomingCallMapType,
  callback: (null | (err: ?any) => void)
}

export type track_fakeTrackingChanged_result = void

export type track_fakeTrackingChanged_rpc = {
  method: 'track.fakeTrackingChanged',
  param: {
    username: string
  },
  incomingCallMap: ?incomingCallMapType,
  callback: (null | (err: ?any) => void)
}

export type track_trackWithToken_result = void

export type track_trackWithToken_rpc = {
  method: 'track.trackWithToken',
  param: {
    trackToken: TrackToken,
    options: TrackOptions
  },
  incomingCallMap: ?incomingCallMapType,
  callback: (null | (err: ?any) => void)
}

export type track_track_result = void

export type track_track_rpc = {
  method: 'track.track',
  param: {
    userAssertion: string,
    options: TrackOptions,
    forceRemoteCheck: boolean
  },
  incomingCallMap: ?incomingCallMapType,
  callback: (null | (err: ?any) => void)
}

export type track_untrack_result = void

export type track_untrack_rpc = {
  method: 'track.untrack',
  param: {
    username: string
  },
  incomingCallMap: ?incomingCallMapType,
  callback: (null | (err: ?any) => void)
}

export type ui_promptYesNo_result = boolean

export type ui_promptYesNo_rpc = {
  method: 'ui.promptYesNo',
  param: {
    text: Text,
    promptDefault: PromptDefault
  },
  incomingCallMap: ?incomingCallMapType,
  callback: (null | (err: ?any, response: ui_promptYesNo_result) => void)
}

export type updateUi_updateAppInUse_result = UpdateAppInUseRes

export type updateUi_updateAppInUse_rpc = {
  method: 'updateUi.updateAppInUse',
  param: {
    update: Update,
    processes: Array<Process>
  },
  incomingCallMap: ?incomingCallMapType,
  callback: (null | (err: ?any, response: updateUi_updateAppInUse_result) => void)
}

export type updateUi_updatePrompt_result = UpdatePromptRes

export type updateUi_updatePrompt_rpc = {
  method: 'updateUi.updatePrompt',
  param: {
    update: Update,
    options: UpdatePromptOptions
  },
  incomingCallMap: ?incomingCallMapType,
  callback: (null | (err: ?any, response: updateUi_updatePrompt_result) => void)
}

export type updateUi_updateQuit_result = UpdateQuitRes

export type updateUi_updateQuit_rpc = {
  method: 'updateUi.updateQuit',
  param: {
    update: Update,
    status: Status
  },
  incomingCallMap: ?incomingCallMapType,
  callback: (null | (err: ?any, response: updateUi_updateQuit_result) => void)
}

export type update_updateCheck_result = void

export type update_updateCheck_rpc = {
  method: 'update.updateCheck',
  param: {
    force: boolean
  },
  incomingCallMap: ?incomingCallMapType,
  callback: (null | (err: ?any) => void)
}

export type update_update_result = UpdateResult

export type update_update_rpc = {
  method: 'update.update',
  param: {
    options: UpdateOptions
  },
  incomingCallMap: ?incomingCallMapType,
  callback: (null | (err: ?any, response: update_update_result) => void)
}

export type user_listTrackersByName_result = Array<Tracker>

export type user_listTrackersByName_rpc = {
  method: 'user.listTrackersByName',
  param: {
    username: string
  },
  incomingCallMap: ?incomingCallMapType,
  callback: (null | (err: ?any, response: user_listTrackersByName_result) => void)
}

export type user_listTrackersSelf_result = Array<Tracker>

export type user_listTrackersSelf_rpc = {
  method: 'user.listTrackersSelf',
  param: {},
  incomingCallMap: ?incomingCallMapType,
  callback: (null | (err: ?any, response: user_listTrackersSelf_result) => void)
}

export type user_listTrackers_result = Array<Tracker>

export type user_listTrackers_rpc = {
  method: 'user.listTrackers',
  param: {
    uid: UID
  },
  incomingCallMap: ?incomingCallMapType,
  callback: (null | (err: ?any, response: user_listTrackers_result) => void)
}

export type user_listTrackingJSON_result = string

export type user_listTrackingJSON_rpc = {
  method: 'user.listTrackingJSON',
  param: {
    filter: string,
    verbose: boolean
  },
  incomingCallMap: ?incomingCallMapType,
  callback: (null | (err: ?any, response: user_listTrackingJSON_result) => void)
}

export type user_listTracking_result = Array<UserSummary>

export type user_listTracking_rpc = {
  method: 'user.listTracking',
  param: {
    filter: string
  },
  incomingCallMap: ?incomingCallMapType,
  callback: (null | (err: ?any, response: user_listTracking_result) => void)
}

export type user_loadPublicKeys_result = Array<PublicKey>

export type user_loadPublicKeys_rpc = {
  method: 'user.loadPublicKeys',
  param: {
    uid: UID
  },
  incomingCallMap: ?incomingCallMapType,
  callback: (null | (err: ?any, response: user_loadPublicKeys_result) => void)
}

export type user_loadUncheckedUserSummaries_result = Array<UserSummary>

export type user_loadUncheckedUserSummaries_rpc = {
  method: 'user.loadUncheckedUserSummaries',
  param: {
    uids: Array<UID>
  },
  incomingCallMap: ?incomingCallMapType,
  callback: (null | (err: ?any, response: user_loadUncheckedUserSummaries_result) => void)
}

export type user_loadUserPlusKeys_result = UserPlusKeys

export type user_loadUserPlusKeys_rpc = {
  method: 'user.loadUserPlusKeys',
  param: {
    uid: UID
  },
  incomingCallMap: ?incomingCallMapType,
  callback: (null | (err: ?any, response: user_loadUserPlusKeys_result) => void)
}

export type user_loadUser_result = User

export type user_loadUser_rpc = {
  method: 'user.loadUser',
  param: {
    uid: UID
  },
  incomingCallMap: ?incomingCallMapType,
  callback: (null | (err: ?any, response: user_loadUser_result) => void)
}

export type user_search_result = Array<SearchResult>

export type user_search_rpc = {
  method: 'user.search',
  param: {
    query: string
  },
  incomingCallMap: ?incomingCallMapType,
  callback: (null | (err: ?any, response: user_search_result) => void)
}

export type rpc =
    BTC_registerBTC_rpc
  | Kex2Provisionee_didCounterSign_rpc
  | Kex2Provisionee_hello_rpc
  | Kex2Provisioner_kexStart_rpc
  | NotifyFS_FSActivity_rpc
  | NotifySession_loggedIn_rpc
  | NotifySession_loggedOut_rpc
  | NotifyTracking_trackingChanged_rpc
  | NotifyUsers_userChanged_rpc
  | SecretKeys_getSecretKeys_rpc
  | account_passphraseChange_rpc
  | account_passphrasePrompt_rpc
  | block_addReference_rpc
  | block_archiveReference_rpc
  | block_authenticateSession_rpc
  | block_delReference_rpc
  | block_getBlock_rpc
  | block_getSessionChallenge_rpc
  | block_getUserQuotaInfo_rpc
  | block_putBlock_rpc
  | config_clearValue_rpc
  | config_getConfig_rpc
  | config_getCurrentStatus_rpc
  | config_getExtendedStatus_rpc
  | config_getValue_rpc
  | config_helloIAm_rpc
  | config_setPath_rpc
  | config_setUserConfig_rpc
  | config_setValue_rpc
  | crypto_signED25519_rpc
  | crypto_signToString_rpc
  | crypto_unboxBytes32Any_rpc
  | crypto_unboxBytes32_rpc
  | ctl_dbNuke_rpc
  | ctl_logRotate_rpc
  | ctl_reload_rpc
  | ctl_stop_rpc
  | debugging_firstStep_rpc
  | debugging_increment_rpc
  | debugging_secondStep_rpc
  | delegateUiCtl_registerIdentifyUI_rpc
  | delegateUiCtl_registerSecretUI_rpc
  | delegateUiCtl_registerUpdateUI_rpc
  | device_deviceAdd_rpc
  | device_deviceList_rpc
  | favorite_favoriteAdd_rpc
  | favorite_favoriteDelete_rpc
  | favorite_favoriteList_rpc
  | gpgUi_confirmDuplicateKeyChosen_rpc
  | gpgUi_selectKeyAndPushOption_rpc
  | gpgUi_selectKey_rpc
  | gpgUi_sign_rpc
  | gpgUi_wantToAddGPGKey_rpc
  | identifyUi_confirm_rpc
  | identifyUi_delegateIdentifyUI_rpc
  | identifyUi_displayCryptocurrency_rpc
  | identifyUi_displayKey_rpc
  | identifyUi_displayTrackStatement_rpc
  | identifyUi_displayUserCard_rpc
  | identifyUi_finishSocialProofCheck_rpc
  | identifyUi_finishWebProofCheck_rpc
  | identifyUi_finish_rpc
  | identifyUi_launchNetworkChecks_rpc
  | identifyUi_reportLastTrack_rpc
  | identifyUi_reportTrackToken_rpc
  | identifyUi_start_rpc
  | identify_Resolve2_rpc
  | identify_Resolve_rpc
  | identify_identify2_rpc
  | identify_identify_rpc
  | kbfs_FSEvent_rpc
  | logUi_log_rpc
  | log_registerLogger_rpc
  | loginUi_displayPaperKeyPhrase_rpc
  | loginUi_displayPrimaryPaperKey_rpc
  | loginUi_getEmailOrUsername_rpc
  | loginUi_promptRevokePaperKeys_rpc
  | login_clearStoredSecret_rpc
  | login_deprovision_rpc
  | login_getConfiguredAccounts_rpc
  | login_login_rpc
  | login_logout_rpc
  | login_paperKey_rpc
  | login_recoverAccountFromEmailAddress_rpc
  | login_unlockWithPassphrase_rpc
  | login_unlock_rpc
  | metadataUpdate_folderNeedsRekey_rpc
  | metadataUpdate_metadataUpdate_rpc
  | metadata_authenticate_rpc
  | metadata_deleteKey_rpc
  | metadata_getChallenge_rpc
  | metadata_getFolderHandle_rpc
  | metadata_getFoldersForRekey_rpc
  | metadata_getKey_rpc
  | metadata_getMerkleNode_rpc
  | metadata_getMerkleRootLatest_rpc
  | metadata_getMerkleRootSince_rpc
  | metadata_getMerkleRoot_rpc
  | metadata_getMetadata_rpc
  | metadata_ping_rpc
  | metadata_pruneBranch_rpc
  | metadata_putKeys_rpc
  | metadata_putMetadata_rpc
  | metadata_registerForUpdates_rpc
  | metadata_truncateLock_rpc
  | metadata_truncateUnlock_rpc
  | notifyCtl_setNotifications_rpc
  | pgpUi_outputSignatureSuccess_rpc
  | pgp_pgpDecrypt_rpc
  | pgp_pgpDeletePrimary_rpc
  | pgp_pgpEncrypt_rpc
  | pgp_pgpExportByFingerprint_rpc
  | pgp_pgpExportByKID_rpc
  | pgp_pgpExport_rpc
  | pgp_pgpImport_rpc
  | pgp_pgpKeyGen_rpc
  | pgp_pgpPull_rpc
  | pgp_pgpSelect_rpc
  | pgp_pgpSign_rpc
  | pgp_pgpUpdate_rpc
  | pgp_pgpVerify_rpc
  | proveUi_displayRecheckWarning_rpc
  | proveUi_okToCheck_rpc
  | proveUi_outputInstructions_rpc
  | proveUi_outputPrechecks_rpc
  | proveUi_preProofWarning_rpc
  | proveUi_promptOverwrite_rpc
  | proveUi_promptUsername_rpc
  | prove_checkProof_rpc
  | prove_startProof_rpc
  | provisionUi_DisplayAndPromptSecret_rpc
  | provisionUi_DisplaySecretExchanged_rpc
  | provisionUi_PromptNewDeviceName_rpc
  | provisionUi_ProvisioneeSuccess_rpc
  | provisionUi_ProvisionerSuccess_rpc
  | provisionUi_chooseDeviceType_rpc
  | provisionUi_chooseDevice_rpc
  | provisionUi_chooseGPGMethod_rpc
  | provisionUi_chooseProvisioningMethod_rpc
  | provisionUi_switchToGPGSignOK_rpc
  | quota_verifySession_rpc
  | revoke_revokeDevice_rpc
  | revoke_revokeKey_rpc
  | revoke_revokeSigs_rpc
  | saltpackUi_saltpackPromptForDecrypt_rpc
  | saltpackUi_saltpackVerifySuccess_rpc
  | saltpack_saltpackDecrypt_rpc
  | saltpack_saltpackEncrypt_rpc
  | saltpack_saltpackSign_rpc
  | saltpack_saltpackVerify_rpc
  | secretUi_getPassphrase_rpc
  | session_currentSession_rpc
  | signup_checkInvitationCode_rpc
  | signup_checkUsernameAvailable_rpc
  | signup_inviteRequest_rpc
  | signup_signup_rpc
  | sigs_sigListJSON_rpc
  | sigs_sigList_rpc
  | streamUi_close_rpc
  | streamUi_read_rpc
  | streamUi_write_rpc
  | test_panic_rpc
  | test_testCallback_rpc
  | test_test_rpc
  | track_checkTracking_rpc
  | track_fakeTrackingChanged_rpc
  | track_trackWithToken_rpc
  | track_track_rpc
  | track_untrack_rpc
  | ui_promptYesNo_rpc
  | updateUi_updateAppInUse_rpc
  | updateUi_updatePrompt_rpc
  | updateUi_updateQuit_rpc
  | update_updateCheck_rpc
  | update_update_rpc
  | user_listTrackersByName_rpc
  | user_listTrackersSelf_rpc
  | user_listTrackers_rpc
  | user_listTrackingJSON_rpc
  | user_listTracking_rpc
  | user_loadPublicKeys_rpc
  | user_loadUncheckedUserSummaries_rpc
  | user_loadUserPlusKeys_rpc
  | user_loadUser_rpc
  | user_search_rpc

export type incomingCallMapType = {
  'keybase.1.account.passphraseChange'?: (
    params: {
      sessionID: int,
      oldPassphrase: string,
      passphrase: string,
      force: boolean
    },
    response: {
      error: (err: RPCError) => void,
      result: () => void
    }
  ) => void,
  'keybase.1.account.passphrasePrompt'?: (
    params: {
      sessionID: int,
      guiArg: GUIEntryArg
    },
    response: {
      error: (err: RPCError) => void,
      result: (result: account_passphrasePrompt_result) => void
    }
  ) => void,
  'keybase.1.block.getSessionChallenge'?: (
    params: {},
    response: {
      error: (err: RPCError) => void,
      result: (result: block_getSessionChallenge_result) => void
    }
  ) => void,
  'keybase.1.block.authenticateSession'?: (
    params: {
      signature: string
    },
    response: {
      error: (err: RPCError) => void,
      result: () => void
    }
  ) => void,
  'keybase.1.block.putBlock'?: (
    params: {
      bid: BlockIdCombo,
      folder: string,
      blockKey: string,
      buf: bytes
    },
    response: {
      error: (err: RPCError) => void,
      result: () => void
    }
  ) => void,
  'keybase.1.block.getBlock'?: (
    params: {
      bid: BlockIdCombo,
      folder: string
    },
    response: {
      error: (err: RPCError) => void,
      result: (result: block_getBlock_result) => void
    }
  ) => void,
  'keybase.1.block.addReference'?: (
    params: {
      folder: string,
      ref: BlockReference
    },
    response: {
      error: (err: RPCError) => void,
      result: () => void
    }
  ) => void,
  'keybase.1.block.delReference'?: (
    params: {
      folder: string,
      ref: BlockReference
    },
    response: {
      error: (err: RPCError) => void,
      result: () => void
    }
  ) => void,
  'keybase.1.block.archiveReference'?: (
    params: {
      folder: string,
      refs: Array<BlockReference>
    },
    response: {
      error: (err: RPCError) => void,
      result: (result: block_archiveReference_result) => void
    }
  ) => void,
  'keybase.1.block.getUserQuotaInfo'?: (
    params: {},
    response: {
      error: (err: RPCError) => void,
      result: (result: block_getUserQuotaInfo_result) => void
    }
  ) => void,
  'keybase.1.BTC.registerBTC'?: (
    params: {
      sessionID: int,
      address: string,
      force: boolean
    },
    response: {
      error: (err: RPCError) => void,
      result: () => void
    }
  ) => void,
  'keybase.1.config.getCurrentStatus'?: (
    params: {
      sessionID: int
    },
    response: {
      error: (err: RPCError) => void,
      result: (result: config_getCurrentStatus_result) => void
    }
  ) => void,
  'keybase.1.config.getExtendedStatus'?: (
    params: {
      sessionID: int
    },
    response: {
      error: (err: RPCError) => void,
      result: (result: config_getExtendedStatus_result) => void
    }
  ) => void,
  'keybase.1.config.getConfig'?: (
    params: {
      sessionID: int
    },
    response: {
      error: (err: RPCError) => void,
      result: (result: config_getConfig_result) => void
    }
  ) => void,
  'keybase.1.config.setUserConfig'?: (
    params: {
      sessionID: int,
      username: string,
      key: string,
      value: string
    },
    response: {
      error: (err: RPCError) => void,
      result: () => void
    }
  ) => void,
  'keybase.1.config.setPath'?: (
    params: {
      sessionID: int,
      path: string
    },
    response: {
      error: (err: RPCError) => void,
      result: () => void
    }
  ) => void,
  'keybase.1.config.helloIAm'?: (
    params: {
      details: ClientDetails
    },
    response: {
      error: (err: RPCError) => void,
      result: () => void
    }
  ) => void,
  'keybase.1.config.setValue'?: (
    params: {
      path: string,
      value: ConfigValue
    },
    response: {
      error: (err: RPCError) => void,
      result: () => void
    }
  ) => void,
  'keybase.1.config.clearValue'?: (
    params: {
      path: string
    },
    response: {
      error: (err: RPCError) => void,
      result: () => void
    }
  ) => void,
  'keybase.1.config.getValue'?: (
    params: {
      path: string
    },
    response: {
      error: (err: RPCError) => void,
      result: (result: config_getValue_result) => void
    }
  ) => void,
  'keybase.1.crypto.signED25519'?: (
    params: {
      sessionID: int,
      msg: bytes,
      reason: string
    },
    response: {
      error: (err: RPCError) => void,
      result: (result: crypto_signED25519_result) => void
    }
  ) => void,
  'keybase.1.crypto.signToString'?: (
    params: {
      sessionID: int,
      msg: bytes,
      reason: string
    },
    response: {
      error: (err: RPCError) => void,
      result: (result: crypto_signToString_result) => void
    }
  ) => void,
  'keybase.1.crypto.unboxBytes32'?: (
    params: {
      sessionID: int,
      encryptedBytes32: EncryptedBytes32,
      nonce: BoxNonce,
      peersPublicKey: BoxPublicKey,
      reason: string
    },
    response: {
      error: (err: RPCError) => void,
      result: (result: crypto_unboxBytes32_result) => void
    }
  ) => void,
  'keybase.1.crypto.unboxBytes32Any'?: (
    params: {
      sessionID: int,
      bundles: Array<CiphertextBundle>,
      reason: string,
      promptPaper: boolean
    },
    response: {
      error: (err: RPCError) => void,
      result: (result: crypto_unboxBytes32Any_result) => void
    }
  ) => void,
  'keybase.1.ctl.stop'?: (
    params: {
      sessionID: int,
      exitCode: ExitCode
    },
    response: {
      error: (err: RPCError) => void,
      result: () => void
    }
  ) => void,
  'keybase.1.ctl.logRotate'?: (
    params: {
      sessionID: int
    },
    response: {
      error: (err: RPCError) => void,
      result: () => void
    }
  ) => void,
  'keybase.1.ctl.reload'?: (
    params: {
      sessionID: int
    },
    response: {
      error: (err: RPCError) => void,
      result: () => void
    }
  ) => void,
  'keybase.1.ctl.dbNuke'?: (
    params: {
      sessionID: int
    },
    response: {
      error: (err: RPCError) => void,
      result: () => void
    }
  ) => void,
  'keybase.1.debugging.firstStep'?: (
    params: {
      sessionID: int,
      val: int
    },
    response: {
      error: (err: RPCError) => void,
      result: (result: debugging_firstStep_result) => void
    }
  ) => void,
  'keybase.1.debugging.secondStep'?: (
    params: {
      sessionID: int,
      val: int
    },
    response: {
      error: (err: RPCError) => void,
      result: (result: debugging_secondStep_result) => void
    }
  ) => void,
  'keybase.1.debugging.increment'?: (
    params: {
      sessionID: int,
      val: int
    },
    response: {
      error: (err: RPCError) => void,
      result: (result: debugging_increment_result) => void
    }
  ) => void,
  'keybase.1.delegateUiCtl.registerIdentifyUI'?: (
    params: {},
    response: {
      error: (err: RPCError) => void,
      result: () => void
    }
  ) => void,
  'keybase.1.delegateUiCtl.registerSecretUI'?: (
    params: {},
    response: {
      error: (err: RPCError) => void,
      result: () => void
    }
  ) => void,
  'keybase.1.delegateUiCtl.registerUpdateUI'?: (
    params: {},
    response: {
      error: (err: RPCError) => void,
      result: () => void
    }
  ) => void,
  'keybase.1.device.deviceList'?: (
    params: {
      sessionID: int
    },
    response: {
      error: (err: RPCError) => void,
      result: (result: device_deviceList_result) => void
    }
  ) => void,
  'keybase.1.device.deviceAdd'?: (
    params: {
      sessionID: int
    },
    response: {
      error: (err: RPCError) => void,
      result: () => void
    }
  ) => void,
  'keybase.1.favorite.favoriteAdd'?: (
    params: {
      sessionID: int,
      folder: Folder
    },
    response: {
      error: (err: RPCError) => void,
      result: () => void
    }
  ) => void,
  'keybase.1.favorite.favoriteDelete'?: (
    params: {
      sessionID: int,
      folder: Folder
    },
    response: {
      error: (err: RPCError) => void,
      result: () => void
    }
  ) => void,
  'keybase.1.favorite.favoriteList'?: (
    params: {
      sessionID: int
    },
    response: {
      error: (err: RPCError) => void,
      result: (result: favorite_favoriteList_result) => void
    }
  ) => void,
  'keybase.1.gpgUi.wantToAddGPGKey'?: (
    params: {
      sessionID: int
    },
    response: {
      error: (err: RPCError) => void,
      result: (result: gpgUi_wantToAddGPGKey_result) => void
    }
  ) => void,
  'keybase.1.gpgUi.confirmDuplicateKeyChosen'?: (
    params: {
      sessionID: int
    },
    response: {
      error: (err: RPCError) => void,
      result: (result: gpgUi_confirmDuplicateKeyChosen_result) => void
    }
  ) => void,
  'keybase.1.gpgUi.selectKeyAndPushOption'?: (
    params: {
      sessionID: int,
      keys: Array<GPGKey>
    },
    response: {
      error: (err: RPCError) => void,
      result: (result: gpgUi_selectKeyAndPushOption_result) => void
    }
  ) => void,
  'keybase.1.gpgUi.selectKey'?: (
    params: {
      sessionID: int,
      keys: Array<GPGKey>
    },
    response: {
      error: (err: RPCError) => void,
      result: (result: gpgUi_selectKey_result) => void
    }
  ) => void,
  'keybase.1.gpgUi.sign'?: (
    params: {
      msg: bytes,
      fingerprint: bytes
    },
    response: {
      error: (err: RPCError) => void,
      result: (result: gpgUi_sign_result) => void
    }
  ) => void,
  'keybase.1.identify.Resolve'?: (
    params: {
      assertion: string
    },
    response: {
      error: (err: RPCError) => void,
      result: (result: identify_Resolve_result) => void
    }
  ) => void,
  'keybase.1.identify.Resolve2'?: (
    params: {
      assertion: string
    },
    response: {
      error: (err: RPCError) => void,
      result: (result: identify_Resolve2_result) => void
    }
  ) => void,
  'keybase.1.identify.identify'?: (
    params: {
      sessionID: int,
      userAssertion: string,
      trackStatement: boolean,
      forceRemoteCheck: boolean,
      useDelegateUI: boolean,
      reason: IdentifyReason,
      source: ClientType
    },
    response: {
      error: (err: RPCError) => void,
      result: (result: identify_identify_result) => void
    }
  ) => void,
  'keybase.1.identify.identify2'?: (
    params: {
      sessionID: int,
      uid: UID,
      userAssertion: string,
      reason: IdentifyReason,
      useDelegateUI: boolean,
      alwaysBlock: boolean,
      noErrorOnTrackFailure: boolean,
      forceRemoteCheck: boolean,
      needProofSet: boolean
    },
    response: {
      error: (err: RPCError) => void,
      result: (result: identify_identify2_result) => void
    }
  ) => void,
  'keybase.1.identifyUi.delegateIdentifyUI'?: (
    params: {},
    response: {
      error: (err: RPCError) => void,
      result: (result: identifyUi_delegateIdentifyUI_result) => void
    }
  ) => void,
  'keybase.1.identifyUi.start'?: (
    params: {
      sessionID: int,
      username: string,
      reason: IdentifyReason
    },
    response: {
      error: (err: RPCError) => void,
      result: () => void
    }
  ) => void,
  'keybase.1.identifyUi.displayKey'?: (
    params: {
      sessionID: int,
      key: IdentifyKey
    },
    response: {
      error: (err: RPCError) => void,
      result: () => void
    }
  ) => void,
  'keybase.1.identifyUi.reportLastTrack'?: (
    params: {
      sessionID: int,
      track: (null | TrackSummary)
    },
    response: {
      error: (err: RPCError) => void,
      result: () => void
    }
  ) => void,
  'keybase.1.identifyUi.launchNetworkChecks'?: (
    params: {
      sessionID: int,
      identity: Identity,
      user: User
    },
    response: {
      error: (err: RPCError) => void,
      result: () => void
    }
  ) => void,
  'keybase.1.identifyUi.displayTrackStatement'?: (
    params: {
      sessionID: int,
      stmt: string
    },
    response: {
      error: (err: RPCError) => void,
      result: () => void
    }
  ) => void,
  'keybase.1.identifyUi.finishWebProofCheck'?: (
    params: {
      sessionID: int,
      rp: RemoteProof,
      lcr: LinkCheckResult
    },
    response: {
      error: (err: RPCError) => void,
      result: () => void
    }
  ) => void,
  'keybase.1.identifyUi.finishSocialProofCheck'?: (
    params: {
      sessionID: int,
      rp: RemoteProof,
      lcr: LinkCheckResult
    },
    response: {
      error: (err: RPCError) => void,
      result: () => void
    }
  ) => void,
  'keybase.1.identifyUi.displayCryptocurrency'?: (
    params: {
      sessionID: int,
      c: Cryptocurrency
    },
    response: {
      error: (err: RPCError) => void,
      result: () => void
    }
  ) => void,
  'keybase.1.identifyUi.reportTrackToken'?: (
    params: {
      sessionID: int,
      trackToken: TrackToken
    },
    response: {
      error: (err: RPCError) => void,
      result: () => void
    }
  ) => void,
  'keybase.1.identifyUi.displayUserCard'?: (
    params: {
      sessionID: int,
      card: UserCard
    },
    response: {
      error: (err: RPCError) => void,
      result: () => void
    }
  ) => void,
  'keybase.1.identifyUi.confirm'?: (
    params: {
      sessionID: int,
      outcome: IdentifyOutcome
    },
    response: {
      error: (err: RPCError) => void,
      result: (result: identifyUi_confirm_result) => void
    }
  ) => void,
  'keybase.1.identifyUi.finish'?: (
    params: {
      sessionID: int
    },
    response: {
      error: (err: RPCError) => void,
      result: () => void
    }
  ) => void,
  'keybase.1.kbfs.FSEvent'?: (
    params: {
      event: FSNotification
    },
    response: {
      error: (err: RPCError) => void,
      result: () => void
    }
  ) => void,
  'keybase.1.Kex2Provisionee.hello'?: (
    params: {
      uid: UID,
      token: SessionToken,
      csrf: CsrfToken,
      pps: PassphraseStream,
      sigBody: string
    },
    response: {
      error: (err: RPCError) => void,
      result: (result: Kex2Provisionee_hello_result) => void
    }
  ) => void,
  'keybase.1.Kex2Provisionee.didCounterSign'?: (
    params: {
      sig: bytes
    },
    response: {
      error: (err: RPCError) => void,
      result: () => void
    }
  ) => void,
  'keybase.1.Kex2Provisioner.kexStart'?: (
    params: {} /* ,
    response: {} // Notify call
    */
  ) => void,
  'keybase.1.log.registerLogger'?: (
    params: {
      sessionID: int,
      name: string,
      level: LogLevel
    },
    response: {
      error: (err: RPCError) => void,
      result: () => void
    }
  ) => void,
  'keybase.1.logUi.log'?: (
    params: {
      sessionID: int,
      level: LogLevel,
      text: Text
    },
    response: {
      error: (err: RPCError) => void,
      result: () => void
    }
  ) => void,
  'keybase.1.login.getConfiguredAccounts'?: (
    params: {
      sessionID: int
    },
    response: {
      error: (err: RPCError) => void,
      result: (result: login_getConfiguredAccounts_result) => void
    }
  ) => void,
  'keybase.1.login.login'?: (
    params: {
      sessionID: int,
      deviceType: string,
      usernameOrEmail: string,
      clientType: ClientType
    },
    response: {
      error: (err: RPCError) => void,
      result: () => void
    }
  ) => void,
  'keybase.1.login.clearStoredSecret'?: (
    params: {
      sessionID: int,
      username: string
    },
    response: {
      error: (err: RPCError) => void,
      result: () => void
    }
  ) => void,
  'keybase.1.login.logout'?: (
    params: {
      sessionID: int
    },
    response: {
      error: (err: RPCError) => void,
      result: () => void
    }
  ) => void,
  'keybase.1.login.deprovision'?: (
    params: {
      sessionID: int,
      username: string,
      doRevoke: boolean
    },
    response: {
      error: (err: RPCError) => void,
      result: () => void
    }
  ) => void,
  'keybase.1.login.recoverAccountFromEmailAddress'?: (
    params: {
      email: string
    },
    response: {
      error: (err: RPCError) => void,
      result: () => void
    }
  ) => void,
  'keybase.1.login.paperKey'?: (
    params: {
      sessionID: int
    },
    response: {
      error: (err: RPCError) => void,
      result: () => void
    }
  ) => void,
  'keybase.1.login.unlock'?: (
    params: {
      sessionID: int
    },
    response: {
      error: (err: RPCError) => void,
      result: () => void
    }
  ) => void,
  'keybase.1.login.unlockWithPassphrase'?: (
    params: {
      sessionID: int,
      passphrase: string
    },
    response: {
      error: (err: RPCError) => void,
      result: () => void
    }
  ) => void,
  'keybase.1.loginUi.getEmailOrUsername'?: (
    params: {
      sessionID: int
    },
    response: {
      error: (err: RPCError) => void,
      result: (result: loginUi_getEmailOrUsername_result) => void
    }
  ) => void,
  'keybase.1.loginUi.promptRevokePaperKeys'?: (
    params: {
      sessionID: int,
      device: Device,
      index: int
    },
    response: {
      error: (err: RPCError) => void,
      result: (result: loginUi_promptRevokePaperKeys_result) => void
    }
  ) => void,
  'keybase.1.loginUi.displayPaperKeyPhrase'?: (
    params: {
      sessionID: int,
      phrase: string
    },
    response: {
      error: (err: RPCError) => void,
      result: () => void
    }
  ) => void,
  'keybase.1.loginUi.displayPrimaryPaperKey'?: (
    params: {
      sessionID: int,
      phrase: string
    },
    response: {
      error: (err: RPCError) => void,
      result: () => void
    }
  ) => void,
  'keybase.1.metadata.getChallenge'?: (
    params: {},
    response: {
      error: (err: RPCError) => void,
      result: (result: metadata_getChallenge_result) => void
    }
  ) => void,
  'keybase.1.metadata.authenticate'?: (
    params: {
      signature: string
    },
    response: {
      error: (err: RPCError) => void,
      result: (result: metadata_authenticate_result) => void
    }
  ) => void,
  'keybase.1.metadata.putMetadata'?: (
    params: {
      mdBlock: MDBlock,
      logTags: {string: string}
    },
    response: {
      error: (err: RPCError) => void,
      result: () => void
    }
  ) => void,
  'keybase.1.metadata.getMetadata'?: (
    params: {
      folderID: string,
      folderHandle: bytes,
      branchID: string,
      unmerged: boolean,
      startRevision: long,
      stopRevision: long,
      logTags: {string: string}
    },
    response: {
      error: (err: RPCError) => void,
      result: (result: metadata_getMetadata_result) => void
    }
  ) => void,
  'keybase.1.metadata.registerForUpdates'?: (
    params: {
      folderID: string,
      currRevision: long,
      logTags: {string: string}
    },
    response: {
      error: (err: RPCError) => void,
      result: () => void
    }
  ) => void,
  'keybase.1.metadata.pruneBranch'?: (
    params: {
      folderID: string,
      branchID: string,
      logTags: {string: string}
    },
    response: {
      error: (err: RPCError) => void,
      result: () => void
    }
  ) => void,
  'keybase.1.metadata.putKeys'?: (
    params: {
      keyHalves: Array<KeyHalf>,
      logTags: {string: string}
    },
    response: {
      error: (err: RPCError) => void,
      result: () => void
    }
  ) => void,
  'keybase.1.metadata.getKey'?: (
    params: {
      keyHalfID: bytes,
      deviceKID: string,
      logTags: {string: string}
    },
    response: {
      error: (err: RPCError) => void,
      result: (result: metadata_getKey_result) => void
    }
  ) => void,
  'keybase.1.metadata.deleteKey'?: (
    params: {
      uid: UID,
      deviceKID: KID,
      keyHalfID: bytes,
      logTags: {string: string}
    },
    response: {
      error: (err: RPCError) => void,
      result: () => void
    }
  ) => void,
  'keybase.1.metadata.truncateLock'?: (
    params: {
      folderID: string
    },
    response: {
      error: (err: RPCError) => void,
      result: (result: metadata_truncateLock_result) => void
    }
  ) => void,
  'keybase.1.metadata.truncateUnlock'?: (
    params: {
      folderID: string
    },
    response: {
      error: (err: RPCError) => void,
      result: (result: metadata_truncateUnlock_result) => void
    }
  ) => void,
  'keybase.1.metadata.getFolderHandle'?: (
    params: {
      folderID: string,
      signature: string,
      challenge: string
    },
    response: {
      error: (err: RPCError) => void,
      result: (result: metadata_getFolderHandle_result) => void
    }
  ) => void,
  'keybase.1.metadata.getFoldersForRekey'?: (
    params: {
      deviceKID: KID
    },
    response: {
      error: (err: RPCError) => void,
      result: () => void
    }
  ) => void,
  'keybase.1.metadata.ping'?: (
    params: {},
    response: {
      error: (err: RPCError) => void,
      result: () => void
    }
  ) => void,
  'keybase.1.metadata.getMerkleRoot'?: (
    params: {
      treeID: MerkleTreeID,
      seqNo: long
    },
    response: {
      error: (err: RPCError) => void,
      result: (result: metadata_getMerkleRoot_result) => void
    }
  ) => void,
  'keybase.1.metadata.getMerkleRootLatest'?: (
    params: {
      treeID: MerkleTreeID
    },
    response: {
      error: (err: RPCError) => void,
      result: (result: metadata_getMerkleRootLatest_result) => void
    }
  ) => void,
  'keybase.1.metadata.getMerkleRootSince'?: (
    params: {
      treeID: MerkleTreeID,
      when: Time
    },
    response: {
      error: (err: RPCError) => void,
      result: (result: metadata_getMerkleRootSince_result) => void
    }
  ) => void,
  'keybase.1.metadata.getMerkleNode'?: (
    params: {
      hash: string
    },
    response: {
      error: (err: RPCError) => void,
      result: (result: metadata_getMerkleNode_result) => void
    }
  ) => void,
  'keybase.1.metadataUpdate.metadataUpdate'?: (
    params: {
      folderID: string,
      revision: long
    },
    response: {
      error: (err: RPCError) => void,
      result: () => void
    }
  ) => void,
  'keybase.1.metadataUpdate.folderNeedsRekey'?: (
    params: {
      folderID: string,
      revision: long
    },
    response: {
      error: (err: RPCError) => void,
      result: () => void
    }
  ) => void,
  'keybase.1.notifyCtl.setNotifications'?: (
    params: {
      channels: NotificationChannels
    },
    response: {
      error: (err: RPCError) => void,
      result: () => void
    }
  ) => void,
  'keybase.1.NotifyFS.FSActivity'?: (
    params: {
      notification: FSNotification
    } /* ,
    response: {} // Notify call
    */
  ) => void,
  'keybase.1.NotifySession.loggedOut'?: (
    params: {} /* ,
    response: {} // Notify call
    */
  ) => void,
  'keybase.1.NotifySession.loggedIn'?: (
    params: {
      username: string
    },
    response: {
      error: (err: RPCError) => void,
      result: () => void
    }
  ) => void,
  'keybase.1.NotifyTracking.trackingChanged'?: (
    params: {
      uid: UID,
      username: string
    } /* ,
    response: {} // Notify call
    */
  ) => void,
  'keybase.1.NotifyUsers.userChanged'?: (
    params: {
      uid: UID
    } /* ,
    response: {} // Notify call
    */
  ) => void,
  'keybase.1.pgp.pgpSign'?: (
    params: {
      sessionID: int,
      source: Stream,
      sink: Stream,
      opts: PGPSignOptions
    },
    response: {
      error: (err: RPCError) => void,
      result: () => void
    }
  ) => void,
  'keybase.1.pgp.pgpPull'?: (
    params: {
      sessionID: int,
      userAsserts: Array<string>
    },
    response: {
      error: (err: RPCError) => void,
      result: () => void
    }
  ) => void,
  'keybase.1.pgp.pgpEncrypt'?: (
    params: {
      sessionID: int,
      source: Stream,
      sink: Stream,
      opts: PGPEncryptOptions
    },
    response: {
      error: (err: RPCError) => void,
      result: () => void
    }
  ) => void,
  'keybase.1.pgp.pgpDecrypt'?: (
    params: {
      sessionID: int,
      source: Stream,
      sink: Stream,
      opts: PGPDecryptOptions
    },
    response: {
      error: (err: RPCError) => void,
      result: (result: pgp_pgpDecrypt_result) => void
    }
  ) => void,
  'keybase.1.pgp.pgpVerify'?: (
    params: {
      sessionID: int,
      source: Stream,
      opts: PGPVerifyOptions
    },
    response: {
      error: (err: RPCError) => void,
      result: (result: pgp_pgpVerify_result) => void
    }
  ) => void,
  'keybase.1.pgp.pgpImport'?: (
    params: {
      sessionID: int,
      key: bytes,
      pushSecret: boolean
    },
    response: {
      error: (err: RPCError) => void,
      result: () => void
    }
  ) => void,
  'keybase.1.pgp.pgpExport'?: (
    params: {
      sessionID: int,
      options: PGPQuery
    },
    response: {
      error: (err: RPCError) => void,
      result: (result: pgp_pgpExport_result) => void
    }
  ) => void,
  'keybase.1.pgp.pgpExportByFingerprint'?: (
    params: {
      sessionID: int,
      options: PGPQuery
    },
    response: {
      error: (err: RPCError) => void,
      result: (result: pgp_pgpExportByFingerprint_result) => void
    }
  ) => void,
  'keybase.1.pgp.pgpExportByKID'?: (
    params: {
      sessionID: int,
      options: PGPQuery
    },
    response: {
      error: (err: RPCError) => void,
      result: (result: pgp_pgpExportByKID_result) => void
    }
  ) => void,
  'keybase.1.pgp.pgpKeyGen'?: (
    params: {
      sessionID: int,
      primaryBits: int,
      subkeyBits: int,
      createUids: PGPCreateUids,
      allowMulti: boolean,
      doExport: boolean,
      pushSecret: boolean
    },
    response: {
      error: (err: RPCError) => void,
      result: () => void
    }
  ) => void,
  'keybase.1.pgp.pgpDeletePrimary'?: (
    params: {
      sessionID: int
    },
    response: {
      error: (err: RPCError) => void,
      result: () => void
    }
  ) => void,
  'keybase.1.pgp.pgpSelect'?: (
    params: {
      sessionID: int,
      fingerprintQuery: string,
      allowMulti: boolean,
      skipImport: boolean,
      onlyImport: boolean
    },
    response: {
      error: (err: RPCError) => void,
      result: () => void
    }
  ) => void,
  'keybase.1.pgp.pgpUpdate'?: (
    params: {
      sessionID: int,
      all: boolean,
      fingerprints: Array<string>
    },
    response: {
      error: (err: RPCError) => void,
      result: () => void
    }
  ) => void,
  'keybase.1.pgpUi.outputSignatureSuccess'?: (
    params: {
      sessionID: int,
      fingerprint: string,
      username: string,
      signedAt: Time
    },
    response: {
      error: (err: RPCError) => void,
      result: () => void
    }
  ) => void,
  'keybase.1.prove.startProof'?: (
    params: {
      sessionID: int,
      service: string,
      username: string,
      force: boolean,
      promptPosted: boolean
    },
    response: {
      error: (err: RPCError) => void,
      result: (result: prove_startProof_result) => void
    }
  ) => void,
  'keybase.1.prove.checkProof'?: (
    params: {
      sessionID: int,
      sigID: SigID
    },
    response: {
      error: (err: RPCError) => void,
      result: (result: prove_checkProof_result) => void
    }
  ) => void,
  'keybase.1.proveUi.promptOverwrite'?: (
    params: {
      sessionID: int,
      account: string,
      typ: PromptOverwriteType
    },
    response: {
      error: (err: RPCError) => void,
      result: (result: proveUi_promptOverwrite_result) => void
    }
  ) => void,
  'keybase.1.proveUi.promptUsername'?: (
    params: {
      sessionID: int,
      prompt: string,
      prevError: (null | Status)
    },
    response: {
      error: (err: RPCError) => void,
      result: (result: proveUi_promptUsername_result) => void
    }
  ) => void,
  'keybase.1.proveUi.outputPrechecks'?: (
    params: {
      sessionID: int,
      text: Text
    },
    response: {
      error: (err: RPCError) => void,
      result: () => void
    }
  ) => void,
  'keybase.1.proveUi.preProofWarning'?: (
    params: {
      sessionID: int,
      text: Text
    },
    response: {
      error: (err: RPCError) => void,
      result: (result: proveUi_preProofWarning_result) => void
    }
  ) => void,
  'keybase.1.proveUi.outputInstructions'?: (
    params: {
      sessionID: int,
      instructions: Text,
      proof: string
    },
    response: {
      error: (err: RPCError) => void,
      result: () => void
    }
  ) => void,
  'keybase.1.proveUi.okToCheck'?: (
    params: {
      sessionID: int,
      name: string,
      attempt: int
    },
    response: {
      error: (err: RPCError) => void,
      result: (result: proveUi_okToCheck_result) => void
    }
  ) => void,
  'keybase.1.proveUi.displayRecheckWarning'?: (
    params: {
      sessionID: int,
      text: Text
    },
    response: {
      error: (err: RPCError) => void,
      result: () => void
    }
  ) => void,
  'keybase.1.provisionUi.chooseProvisioningMethod'?: (
    params: {
      sessionID: int,
      gpgOption: boolean
    },
    response: {
      error: (err: RPCError) => void,
      result: (result: provisionUi_chooseProvisioningMethod_result) => void
    }
  ) => void,
  'keybase.1.provisionUi.chooseGPGMethod'?: (
    params: {
      sessionID: int,
      keys: Array<GPGKey>
    },
    response: {
      error: (err: RPCError) => void,
      result: (result: provisionUi_chooseGPGMethod_result) => void
    }
  ) => void,
  'keybase.1.provisionUi.switchToGPGSignOK'?: (
    params: {
      sessionID: int,
      key: GPGKey,
      importError: string
    },
    response: {
      error: (err: RPCError) => void,
      result: (result: provisionUi_switchToGPGSignOK_result) => void
    }
  ) => void,
  'keybase.1.provisionUi.chooseDevice'?: (
    params: {
      sessionID: int,
      devices: Array<Device>
    },
    response: {
      error: (err: RPCError) => void,
      result: (result: provisionUi_chooseDevice_result) => void
    }
  ) => void,
  'keybase.1.provisionUi.chooseDeviceType'?: (
    params: {
      sessionID: int,
      kind: ChooseType
    },
    response: {
      error: (err: RPCError) => void,
      result: (result: provisionUi_chooseDeviceType_result) => void
    }
  ) => void,
  'keybase.1.provisionUi.DisplayAndPromptSecret'?: (
    params: {
      sessionID: int,
      secret: bytes,
      phrase: string,
      otherDeviceType: DeviceType
    },
    response: {
      error: (err: RPCError) => void,
      result: (result: provisionUi_DisplayAndPromptSecret_result) => void
    }
  ) => void,
  'keybase.1.provisionUi.DisplaySecretExchanged'?: (
    params: {
      sessionID: int
    },
    response: {
      error: (err: RPCError) => void,
      result: () => void
    }
  ) => void,
  'keybase.1.provisionUi.PromptNewDeviceName'?: (
    params: {
      sessionID: int,
      existingDevices: Array<string>,
      errorMessage: string
    },
    response: {
      error: (err: RPCError) => void,
      result: (result: provisionUi_PromptNewDeviceName_result) => void
    }
  ) => void,
  'keybase.1.provisionUi.ProvisioneeSuccess'?: (
    params: {
      sessionID: int,
      username: string,
      deviceName: string
    },
    response: {
      error: (err: RPCError) => void,
      result: () => void
    }
  ) => void,
  'keybase.1.provisionUi.ProvisionerSuccess'?: (
    params: {
      sessionID: int,
      deviceName: string,
      deviceType: string
    },
    response: {
      error: (err: RPCError) => void,
      result: () => void
    }
  ) => void,
  'keybase.1.quota.verifySession'?: (
    params: {
      session: string
    },
    response: {
      error: (err: RPCError) => void,
      result: (result: quota_verifySession_result) => void
    }
  ) => void,
  'keybase.1.revoke.revokeKey'?: (
    params: {
      sessionID: int,
      keyID: KID
    },
    response: {
      error: (err: RPCError) => void,
      result: () => void
    }
  ) => void,
  'keybase.1.revoke.revokeDevice'?: (
    params: {
      sessionID: int,
      deviceID: DeviceID,
      force: boolean
    },
    response: {
      error: (err: RPCError) => void,
      result: () => void
    }
  ) => void,
  'keybase.1.revoke.revokeSigs'?: (
    params: {
      sessionID: int,
      sigIDQueries: Array<string>
    },
    response: {
      error: (err: RPCError) => void,
      result: () => void
    }
  ) => void,
  'keybase.1.saltpack.saltpackEncrypt'?: (
    params: {
      sessionID: int,
      source: Stream,
      sink: Stream,
      opts: SaltpackEncryptOptions
    },
    response: {
      error: (err: RPCError) => void,
      result: () => void
    }
  ) => void,
  'keybase.1.saltpack.saltpackDecrypt'?: (
    params: {
      sessionID: int,
      source: Stream,
      sink: Stream,
      opts: SaltpackDecryptOptions
    },
    response: {
      error: (err: RPCError) => void,
      result: (result: saltpack_saltpackDecrypt_result) => void
    }
  ) => void,
  'keybase.1.saltpack.saltpackSign'?: (
    params: {
      sessionID: int,
      source: Stream,
      sink: Stream,
      opts: SaltpackSignOptions
    },
    response: {
      error: (err: RPCError) => void,
      result: () => void
    }
  ) => void,
  'keybase.1.saltpack.saltpackVerify'?: (
    params: {
      sessionID: int,
      source: Stream,
      sink: Stream,
      opts: SaltpackVerifyOptions
    },
    response: {
      error: (err: RPCError) => void,
      result: () => void
    }
  ) => void,
  'keybase.1.saltpackUi.saltpackPromptForDecrypt'?: (
    params: {
      sessionID: int,
      sender: SaltpackSender
    },
    response: {
      error: (err: RPCError) => void,
      result: () => void
    }
  ) => void,
  'keybase.1.saltpackUi.saltpackVerifySuccess'?: (
    params: {
      sessionID: int,
      signingKID: KID,
      sender: SaltpackSender
    },
    response: {
      error: (err: RPCError) => void,
      result: () => void
    }
  ) => void,
  'keybase.1.secretUi.getPassphrase'?: (
    params: {
      sessionID: int,
      pinentry: GUIEntryArg,
      terminal: (null | SecretEntryArg)
    },
    response: {
      error: (err: RPCError) => void,
      result: (result: secretUi_getPassphrase_result) => void
    }
  ) => void,
  'keybase.1.SecretKeys.getSecretKeys'?: (
    params: {
      sessionID: int
    },
    response: {
      error: (err: RPCError) => void,
      result: (result: SecretKeys_getSecretKeys_result) => void
    }
  ) => void,
  'keybase.1.session.currentSession'?: (
    params: {
      sessionID: int
    },
    response: {
      error: (err: RPCError) => void,
      result: (result: session_currentSession_result) => void
    }
  ) => void,
  'keybase.1.signup.checkUsernameAvailable'?: (
    params: {
      sessionID: int,
      username: string
    },
    response: {
      error: (err: RPCError) => void,
      result: () => void
    }
  ) => void,
  'keybase.1.signup.signup'?: (
    params: {
      sessionID: int,
      email: string,
      inviteCode: string,
      passphrase: string,
      username: string,
      deviceName: string,
      storeSecret: boolean,
      skipMail: boolean
    },
    response: {
      error: (err: RPCError) => void,
      result: (result: signup_signup_result) => void
    }
  ) => void,
  'keybase.1.signup.inviteRequest'?: (
    params: {
      sessionID: int,
      email: string,
      fullname: string,
      notes: string
    },
    response: {
      error: (err: RPCError) => void,
      result: () => void
    }
  ) => void,
  'keybase.1.signup.checkInvitationCode'?: (
    params: {
      sessionID: int,
      invitationCode: string
    },
    response: {
      error: (err: RPCError) => void,
      result: () => void
    }
  ) => void,
  'keybase.1.sigs.sigList'?: (
    params: {
      sessionID: int,
      arg: SigListArgs
    },
    response: {
      error: (err: RPCError) => void,
      result: (result: sigs_sigList_result) => void
    }
  ) => void,
  'keybase.1.sigs.sigListJSON'?: (
    params: {
      sessionID: int,
      arg: SigListArgs
    },
    response: {
      error: (err: RPCError) => void,
      result: (result: sigs_sigListJSON_result) => void
    }
  ) => void,
  'keybase.1.streamUi.close'?: (
    params: {
      sessionID: int,
      s: Stream
    },
    response: {
      error: (err: RPCError) => void,
      result: () => void
    }
  ) => void,
  'keybase.1.streamUi.read'?: (
    params: {
      sessionID: int,
      s: Stream,
      sz: int
    },
    response: {
      error: (err: RPCError) => void,
      result: (result: streamUi_read_result) => void
    }
  ) => void,
  'keybase.1.streamUi.write'?: (
    params: {
      sessionID: int,
      s: Stream,
      buf: bytes
    },
    response: {
      error: (err: RPCError) => void,
      result: (result: streamUi_write_result) => void
    }
  ) => void,
  'keybase.1.test.test'?: (
    params: {
      sessionID: int,
      name: string
    },
    response: {
      error: (err: RPCError) => void,
      result: (result: test_test_result) => void
    }
  ) => void,
  'keybase.1.test.testCallback'?: (
    params: {
      sessionID: int,
      name: string
    },
    response: {
      error: (err: RPCError) => void,
      result: (result: test_testCallback_result) => void
    }
  ) => void,
  'keybase.1.test.panic'?: (
    params: {
      message: string
    },
    response: {
      error: (err: RPCError) => void,
      result: () => void
    }
  ) => void,
  'keybase.1.track.track'?: (
    params: {
      sessionID: int,
      userAssertion: string,
      options: TrackOptions,
      forceRemoteCheck: boolean
    },
    response: {
      error: (err: RPCError) => void,
      result: () => void
    }
  ) => void,
  'keybase.1.track.trackWithToken'?: (
    params: {
      sessionID: int,
      trackToken: TrackToken,
      options: TrackOptions
    },
    response: {
      error: (err: RPCError) => void,
      result: () => void
    }
  ) => void,
  'keybase.1.track.untrack'?: (
    params: {
      sessionID: int,
      username: string
    },
    response: {
      error: (err: RPCError) => void,
      result: () => void
    }
  ) => void,
  'keybase.1.track.checkTracking'?: (
    params: {
      sessionID: int
    },
    response: {
      error: (err: RPCError) => void,
      result: () => void
    }
  ) => void,
  'keybase.1.track.fakeTrackingChanged'?: (
    params: {
      sessionID: int,
      username: string
    },
    response: {
      error: (err: RPCError) => void,
      result: () => void
    }
  ) => void,
  'keybase.1.ui.promptYesNo'?: (
    params: {
      sessionID: int,
      text: Text,
      promptDefault: PromptDefault
    },
    response: {
      error: (err: RPCError) => void,
      result: (result: ui_promptYesNo_result) => void
    }
  ) => void,
  'keybase.1.update.update'?: (
    params: {
      options: UpdateOptions
    },
    response: {
      error: (err: RPCError) => void,
      result: (result: update_update_result) => void
    }
  ) => void,
  'keybase.1.update.updateCheck'?: (
    params: {
      force: boolean
    },
    response: {
      error: (err: RPCError) => void,
      result: () => void
    }
  ) => void,
  'keybase.1.updateUi.updatePrompt'?: (
    params: {
      sessionID: int,
      update: Update,
      options: UpdatePromptOptions
    },
    response: {
      error: (err: RPCError) => void,
      result: (result: updateUi_updatePrompt_result) => void
    }
  ) => void,
  'keybase.1.updateUi.updateAppInUse'?: (
    params: {
      sessionID: int,
      update: Update,
      processes: Array<Process>
    },
    response: {
      error: (err: RPCError) => void,
      result: (result: updateUi_updateAppInUse_result) => void
    }
  ) => void,
  'keybase.1.updateUi.updateQuit'?: (
    params: {
      sessionID: int,
      update: Update,
      status: Status
    },
    response: {
      error: (err: RPCError) => void,
      result: (result: updateUi_updateQuit_result) => void
    }
  ) => void,
  'keybase.1.user.listTrackers'?: (
    params: {
      sessionID: int,
      uid: UID
    },
    response: {
      error: (err: RPCError) => void,
      result: (result: user_listTrackers_result) => void
    }
  ) => void,
  'keybase.1.user.listTrackersByName'?: (
    params: {
      sessionID: int,
      username: string
    },
    response: {
      error: (err: RPCError) => void,
      result: (result: user_listTrackersByName_result) => void
    }
  ) => void,
  'keybase.1.user.listTrackersSelf'?: (
    params: {
      sessionID: int
    },
    response: {
      error: (err: RPCError) => void,
      result: (result: user_listTrackersSelf_result) => void
    }
  ) => void,
  'keybase.1.user.loadUncheckedUserSummaries'?: (
    params: {
      sessionID: int,
      uids: Array<UID>
    },
    response: {
      error: (err: RPCError) => void,
      result: (result: user_loadUncheckedUserSummaries_result) => void
    }
  ) => void,
  'keybase.1.user.loadUser'?: (
    params: {
      sessionID: int,
      uid: UID
    },
    response: {
      error: (err: RPCError) => void,
      result: (result: user_loadUser_result) => void
    }
  ) => void,
  'keybase.1.user.loadUserPlusKeys'?: (
    params: {
      sessionID: int,
      uid: UID
    },
    response: {
      error: (err: RPCError) => void,
      result: (result: user_loadUserPlusKeys_result) => void
    }
  ) => void,
  'keybase.1.user.loadPublicKeys'?: (
    params: {
      sessionID: int,
      uid: UID
    },
    response: {
      error: (err: RPCError) => void,
      result: (result: user_loadPublicKeys_result) => void
    }
  ) => void,
  'keybase.1.user.listTracking'?: (
    params: {
      sessionID: int,
      filter: string
    },
    response: {
      error: (err: RPCError) => void,
      result: (result: user_listTracking_result) => void
    }
  ) => void,
  'keybase.1.user.listTrackingJSON'?: (
    params: {
      sessionID: int,
      filter: string,
      verbose: boolean
    },
    response: {
      error: (err: RPCError) => void,
      result: (result: user_listTrackingJSON_result) => void
    }
  ) => void,
  'keybase.1.user.search'?: (
    params: {
      sessionID: int,
      query: string
    },
    response: {
      error: (err: RPCError) => void,
      result: (result: user_search_result) => void
    }
  ) => void
}

