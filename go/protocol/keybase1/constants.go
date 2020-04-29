// Auto-generated to Go types and interfaces using avdl-compiler v1.4.9 (https://github.com/keybase/node-avdl-compiler)
//   Input file: avdl/keybase1/constants.avdl

package keybase1

import (
	"fmt"
	"github.com/keybase/go-framed-msgpack-rpc/rpc"
)

type StatusCode int

const (
	StatusCode_SCOk                                        StatusCode = 0
	StatusCode_SCInputError                                StatusCode = 100
	StatusCode_SCAssertionParseError                       StatusCode = 101
	StatusCode_SCLoginRequired                             StatusCode = 201
	StatusCode_SCBadSession                                StatusCode = 202
	StatusCode_SCBadLoginUserNotFound                      StatusCode = 203
	StatusCode_SCBadLoginPassword                          StatusCode = 204
	StatusCode_SCNotFound                                  StatusCode = 205
	StatusCode_SCThrottleControl                           StatusCode = 210
	StatusCode_SCDeleted                                   StatusCode = 216
	StatusCode_SCGeneric                                   StatusCode = 218
	StatusCode_SCAlreadyLoggedIn                           StatusCode = 235
	StatusCode_SCExists                                    StatusCode = 230
	StatusCode_SCCanceled                                  StatusCode = 237
	StatusCode_SCInputCanceled                             StatusCode = 239
	StatusCode_SCBadUsername                               StatusCode = 243
	StatusCode_SCOffline                                   StatusCode = 267
	StatusCode_SCReloginRequired                           StatusCode = 274
	StatusCode_SCResolutionFailed                          StatusCode = 275
	StatusCode_SCProfileNotPublic                          StatusCode = 276
	StatusCode_SCIdentifyFailed                            StatusCode = 277
	StatusCode_SCTrackingBroke                             StatusCode = 278
	StatusCode_SCWrongCryptoFormat                         StatusCode = 279
	StatusCode_SCDecryptionError                           StatusCode = 280
	StatusCode_SCInvalidAddress                            StatusCode = 281
	StatusCode_SCWrongCryptoMsgType                        StatusCode = 282
	StatusCode_SCNoSession                                 StatusCode = 283
	StatusCode_SCAccountReset                              StatusCode = 290
	StatusCode_SCIdentifiesFailed                          StatusCode = 295
	StatusCode_SCNoSpaceOnDevice                           StatusCode = 297
	StatusCode_SCMerkleClientError                         StatusCode = 299
	StatusCode_SCMerkleUpdateRoot                          StatusCode = 300
	StatusCode_SCBadEmail                                  StatusCode = 472
	StatusCode_SCRateLimit                                 StatusCode = 602
	StatusCode_SCBadSignupUsernameTaken                    StatusCode = 701
	StatusCode_SCDuplicate                                 StatusCode = 706
	StatusCode_SCBadInvitationCode                         StatusCode = 707
	StatusCode_SCBadSignupUsernameReserved                 StatusCode = 710
	StatusCode_SCBadSignupTeamName                         StatusCode = 711
	StatusCode_SCFeatureFlag                               StatusCode = 712
	StatusCode_SCEmailTaken                                StatusCode = 713
	StatusCode_SCEmailAlreadyAdded                         StatusCode = 714
	StatusCode_SCEmailLimitExceeded                        StatusCode = 715
	StatusCode_SCEmailCannotDeletePrimary                  StatusCode = 716
	StatusCode_SCEmailUnknown                              StatusCode = 717
	StatusCode_SCBotSignupTokenNotFound                    StatusCode = 719
	StatusCode_SCNoUpdate                                  StatusCode = 723
	StatusCode_SCMissingResult                             StatusCode = 801
	StatusCode_SCKeyNotFound                               StatusCode = 901
	StatusCode_SCKeyCorrupted                              StatusCode = 905
	StatusCode_SCKeyInUse                                  StatusCode = 907
	StatusCode_SCKeyBadGen                                 StatusCode = 913
	StatusCode_SCKeyNoSecret                               StatusCode = 914
	StatusCode_SCKeyBadUIDs                                StatusCode = 915
	StatusCode_SCKeyNoActive                               StatusCode = 916
	StatusCode_SCKeyNoSig                                  StatusCode = 917
	StatusCode_SCKeyBadSig                                 StatusCode = 918
	StatusCode_SCKeyBadEldest                              StatusCode = 919
	StatusCode_SCKeyNoEldest                               StatusCode = 920
	StatusCode_SCKeyDuplicateUpdate                        StatusCode = 921
	StatusCode_SCSibkeyAlreadyExists                       StatusCode = 922
	StatusCode_SCDecryptionKeyNotFound                     StatusCode = 924
	StatusCode_SCVerificationKeyNotFound                   StatusCode = 925
	StatusCode_SCKeyNoPGPEncryption                        StatusCode = 927
	StatusCode_SCKeyNoNaClEncryption                       StatusCode = 928
	StatusCode_SCKeySyncedPGPNotFound                      StatusCode = 929
	StatusCode_SCKeyNoMatchingGPG                          StatusCode = 930
	StatusCode_SCKeyRevoked                                StatusCode = 931
	StatusCode_SCSigCannotVerify                           StatusCode = 1002
	StatusCode_SCSigWrongKey                               StatusCode = 1008
	StatusCode_SCSigOldSeqno                               StatusCode = 1010
	StatusCode_SCSigCreationDisallowed                     StatusCode = 1016
	StatusCode_SCSigMissingRatchet                         StatusCode = 1021
	StatusCode_SCSigBadTotalOrder                          StatusCode = 1022
	StatusCode_SCBadTrackSession                           StatusCode = 1301
	StatusCode_SCDeviceBadName                             StatusCode = 1404
	StatusCode_SCDeviceBadStatus                           StatusCode = 1405
	StatusCode_SCDeviceNameInUse                           StatusCode = 1408
	StatusCode_SCDeviceNotFound                            StatusCode = 1409
	StatusCode_SCDeviceMismatch                            StatusCode = 1410
	StatusCode_SCDeviceRequired                            StatusCode = 1411
	StatusCode_SCDevicePrevProvisioned                     StatusCode = 1413
	StatusCode_SCDeviceNoProvision                         StatusCode = 1414
	StatusCode_SCDeviceProvisionViaDevice                  StatusCode = 1415
	StatusCode_SCRevokeCurrentDevice                       StatusCode = 1416
	StatusCode_SCRevokeLastDevice                          StatusCode = 1417
	StatusCode_SCDeviceProvisionOffline                    StatusCode = 1418
	StatusCode_SCRevokeLastDevicePGP                       StatusCode = 1419
	StatusCode_SCStreamExists                              StatusCode = 1501
	StatusCode_SCStreamNotFound                            StatusCode = 1502
	StatusCode_SCStreamWrongKind                           StatusCode = 1503
	StatusCode_SCStreamEOF                                 StatusCode = 1504
	StatusCode_SCStreamUnknown                             StatusCode = 1505
	StatusCode_SCGenericAPIError                           StatusCode = 1600
	StatusCode_SCAPINetworkError                           StatusCode = 1601
	StatusCode_SCTimeout                                   StatusCode = 1602
	StatusCode_SCKBFSClientTimeout                         StatusCode = 1603
	StatusCode_SCProofError                                StatusCode = 1701
	StatusCode_SCIdentificationExpired                     StatusCode = 1702
	StatusCode_SCSelfNotFound                              StatusCode = 1703
	StatusCode_SCBadKexPhrase                              StatusCode = 1704
	StatusCode_SCNoUIDelegation                            StatusCode = 1705
	StatusCode_SCNoUI                                      StatusCode = 1706
	StatusCode_SCGPGUnavailable                            StatusCode = 1707
	StatusCode_SCInvalidVersionError                       StatusCode = 1800
	StatusCode_SCOldVersionError                           StatusCode = 1801
	StatusCode_SCInvalidLocationError                      StatusCode = 1802
	StatusCode_SCServiceStatusError                        StatusCode = 1803
	StatusCode_SCInstallError                              StatusCode = 1804
	StatusCode_SCLoadKextError                             StatusCode = 1810
	StatusCode_SCLoadKextPermError                         StatusCode = 1811
	StatusCode_SCGitInternal                               StatusCode = 2300
	StatusCode_SCGitRepoAlreadyExists                      StatusCode = 2301
	StatusCode_SCGitInvalidRepoName                        StatusCode = 2302
	StatusCode_SCGitCannotDelete                           StatusCode = 2303
	StatusCode_SCGitRepoDoesntExist                        StatusCode = 2304
	StatusCode_SCLoginStateTimeout                         StatusCode = 2400
	StatusCode_SCChatInternal                              StatusCode = 2500
	StatusCode_SCChatRateLimit                             StatusCode = 2501
	StatusCode_SCChatConvExists                            StatusCode = 2502
	StatusCode_SCChatUnknownTLFID                          StatusCode = 2503
	StatusCode_SCChatNotInConv                             StatusCode = 2504
	StatusCode_SCChatBadMsg                                StatusCode = 2505
	StatusCode_SCChatBroadcast                             StatusCode = 2506
	StatusCode_SCChatAlreadySuperseded                     StatusCode = 2507
	StatusCode_SCChatAlreadyDeleted                        StatusCode = 2508
	StatusCode_SCChatTLFFinalized                          StatusCode = 2509
	StatusCode_SCChatCollision                             StatusCode = 2510
	StatusCode_SCIdentifySummaryError                      StatusCode = 2511
	StatusCode_SCNeedSelfRekey                             StatusCode = 2512
	StatusCode_SCNeedOtherRekey                            StatusCode = 2513
	StatusCode_SCChatMessageCollision                      StatusCode = 2514
	StatusCode_SCChatDuplicateMessage                      StatusCode = 2515
	StatusCode_SCChatClientError                           StatusCode = 2516
	StatusCode_SCChatNotInTeam                             StatusCode = 2517
	StatusCode_SCChatStalePreviousState                    StatusCode = 2518
	StatusCode_SCChatEphemeralRetentionPolicyViolatedError StatusCode = 2519
	StatusCode_SCChatUsersAlreadyInConversationError       StatusCode = 2520
	StatusCode_SCChatBadConversationError                  StatusCode = 2521
	StatusCode_SCTeamBadMembership                         StatusCode = 2604
	StatusCode_SCTeamSelfNotOwner                          StatusCode = 2607
	StatusCode_SCTeamNotFound                              StatusCode = 2614
	StatusCode_SCTeamExists                                StatusCode = 2619
	StatusCode_SCTeamReadError                             StatusCode = 2623
	StatusCode_SCTeamWritePermDenied                       StatusCode = 2625
	StatusCode_SCTeamBadGeneration                         StatusCode = 2634
	StatusCode_SCNoOp                                      StatusCode = 2638
	StatusCode_SCTeamInviteBadCancel                       StatusCode = 2645
	StatusCode_SCTeamInviteBadToken                        StatusCode = 2646
	StatusCode_SCTeamInviteCompletionMissing               StatusCode = 2648
	StatusCode_SCTeamBadNameReservedDB                     StatusCode = 2650
	StatusCode_SCTeamTarDuplicate                          StatusCode = 2663
	StatusCode_SCTeamTarNotFound                           StatusCode = 2664
	StatusCode_SCTeamMemberExists                          StatusCode = 2665
	StatusCode_SCTeamNotReleased                           StatusCode = 2666
	StatusCode_SCTeamPermanentlyLeft                       StatusCode = 2667
	StatusCode_SCTeamNeedRootId                            StatusCode = 2668
	StatusCode_SCTeamHasLiveChildren                       StatusCode = 2669
	StatusCode_SCTeamDeleteError                           StatusCode = 2670
	StatusCode_SCTeamBadRootTeam                           StatusCode = 2671
	StatusCode_SCTeamNameConflictsWithUser                 StatusCode = 2672
	StatusCode_SCTeamDeleteNoUpPointer                     StatusCode = 2673
	StatusCode_SCTeamNeedOwner                             StatusCode = 2674
	StatusCode_SCTeamNoOwnerAllowed                        StatusCode = 2675
	StatusCode_SCTeamImplicitNoNonSbs                      StatusCode = 2676
	StatusCode_SCTeamImplicitBadHash                       StatusCode = 2677
	StatusCode_SCTeamImplicitBadName                       StatusCode = 2678
	StatusCode_SCTeamImplicitClash                         StatusCode = 2679
	StatusCode_SCTeamImplicitDuplicate                     StatusCode = 2680
	StatusCode_SCTeamImplicitBadOp                         StatusCode = 2681
	StatusCode_SCTeamImplicitBadRole                       StatusCode = 2682
	StatusCode_SCTeamImplicitNotFound                      StatusCode = 2683
	StatusCode_SCTeamBadAdminSeqnoType                     StatusCode = 2684
	StatusCode_SCTeamImplicitBadAdd                        StatusCode = 2685
	StatusCode_SCTeamImplicitBadRemove                     StatusCode = 2686
	StatusCode_SCTeamInviteTokenReused                     StatusCode = 2696
	StatusCode_SCTeamKeyMaskNotFound                       StatusCode = 2697
	StatusCode_SCTeamBanned                                StatusCode = 2702
	StatusCode_SCTeamInvalidBan                            StatusCode = 2703
	StatusCode_SCTeamShowcasePermDenied                    StatusCode = 2711
	StatusCode_SCTeamProvisionalCanKey                     StatusCode = 2721
	StatusCode_SCTeamProvisionalCannotKey                  StatusCode = 2722
	StatusCode_SCTeamFTLOutdated                           StatusCode = 2736
	StatusCode_SCTeamStorageWrongRevision                  StatusCode = 2760
	StatusCode_SCTeamStorageBadGeneration                  StatusCode = 2761
	StatusCode_SCTeamStorageNotFound                       StatusCode = 2762
	StatusCode_SCTeamContactSettingsBlock                  StatusCode = 2763
	StatusCode_SCTeamSeitanInviteNeedPUK                   StatusCode = 2770
	StatusCode_SCEphemeralKeyBadGeneration                 StatusCode = 2900
	StatusCode_SCEphemeralKeyUnexpectedBox                 StatusCode = 2901
	StatusCode_SCEphemeralKeyMissingBox                    StatusCode = 2902
	StatusCode_SCEphemeralKeyWrongNumberOfKeys             StatusCode = 2903
	StatusCode_SCEphemeralKeyMismatchedKey                 StatusCode = 2904
	StatusCode_SCEphemeralPairwiseMACsMissingUIDs          StatusCode = 2905
	StatusCode_SCEphemeralDeviceAfterEK                    StatusCode = 2906
	StatusCode_SCEphemeralMemberAfterEK                    StatusCode = 2907
	StatusCode_SCEphemeralDeviceStale                      StatusCode = 2908
	StatusCode_SCEphemeralUserStale                        StatusCode = 2909
	StatusCode_SCStellarError                              StatusCode = 3100
	StatusCode_SCStellarBadInput                           StatusCode = 3101
	StatusCode_SCStellarWrongRevision                      StatusCode = 3102
	StatusCode_SCStellarMissingBundle                      StatusCode = 3103
	StatusCode_SCStellarBadPuk                             StatusCode = 3104
	StatusCode_SCStellarMissingAccount                     StatusCode = 3105
	StatusCode_SCStellarBadPrev                            StatusCode = 3106
	StatusCode_SCStellarWrongPrimary                       StatusCode = 3107
	StatusCode_SCStellarUnsupportedCurrency                StatusCode = 3108
	StatusCode_SCStellarNeedDisclaimer                     StatusCode = 3109
	StatusCode_SCStellarDeviceNotMobile                    StatusCode = 3110
	StatusCode_SCStellarMobileOnlyPurgatory                StatusCode = 3111
	StatusCode_SCStellarIncompatibleVersion                StatusCode = 3112
	StatusCode_SCNISTWrongSize                             StatusCode = 3201
	StatusCode_SCNISTBadMode                               StatusCode = 3202
	StatusCode_SCNISTHashWrongSize                         StatusCode = 3203
	StatusCode_SCNISTSigWrongSize                          StatusCode = 3204
	StatusCode_SCNISTSigBadInput                           StatusCode = 3205
	StatusCode_SCNISTSigBadUID                             StatusCode = 3206
	StatusCode_SCNISTSigBadDeviceID                        StatusCode = 3207
	StatusCode_SCNISTSigBadNonce                           StatusCode = 3208
	StatusCode_SCNISTNoSigOrHash                           StatusCode = 3209
	StatusCode_SCNISTExpired                               StatusCode = 3210
	StatusCode_SCNISTSigRevoked                            StatusCode = 3211
	StatusCode_SCNISTKeyRevoked                            StatusCode = 3212
	StatusCode_SCNISTUserDeleted                           StatusCode = 3213
	StatusCode_SCNISTNoDevice                              StatusCode = 3214
	StatusCode_SCNISTSigCannot_verify                      StatusCode = 3215
	StatusCode_SCNISTReplay                                StatusCode = 3216
	StatusCode_SCNISTSigBadLifetime                        StatusCode = 3217
	StatusCode_SCNISTNotFound                              StatusCode = 3218
	StatusCode_SCNISTBadClock                              StatusCode = 3219
	StatusCode_SCNISTSigBadCtime                           StatusCode = 3220
	StatusCode_SCBadSignupUsernameDeleted                  StatusCode = 3221
	StatusCode_SCPhoneNumberUnknown                        StatusCode = 3400
	StatusCode_SCPhoneNumberAlreadyVerified                StatusCode = 3401
	StatusCode_SCPhoneNumberVerificationCodeExpired        StatusCode = 3402
	StatusCode_SCPhoneNumberWrongVerificationCode          StatusCode = 3403
	StatusCode_SCPhoneNumberLimitExceeded                  StatusCode = 3404
	StatusCode_SCNoPaperKeys                               StatusCode = 3605
	StatusCode_SCTeambotKeyGenerationExists                StatusCode = 3800
	StatusCode_SCTeambotKeyOldBoxedGeneration              StatusCode = 3801
	StatusCode_SCTeambotKeyBadGeneration                   StatusCode = 3802
	StatusCode_SCAirdropRegisterFailedMisc                 StatusCode = 4207
	StatusCode_SCSimpleFSNameExists                        StatusCode = 5101
	StatusCode_SCSimpleFSDirNotEmpty                       StatusCode = 5102
	StatusCode_SCSimpleFSNotExist                          StatusCode = 5103
	StatusCode_SCSimpleFSNoAccess                          StatusCode = 5104
)

func (o StatusCode) DeepCopy() StatusCode { return o }

var StatusCodeMap = map[string]StatusCode{
	"SCOk":                        0,
	"SCInputError":                100,
	"SCAssertionParseError":       101,
	"SCLoginRequired":             201,
	"SCBadSession":                202,
	"SCBadLoginUserNotFound":      203,
	"SCBadLoginPassword":          204,
	"SCNotFound":                  205,
	"SCThrottleControl":           210,
	"SCDeleted":                   216,
	"SCGeneric":                   218,
	"SCAlreadyLoggedIn":           235,
	"SCExists":                    230,
	"SCCanceled":                  237,
	"SCInputCanceled":             239,
	"SCBadUsername":               243,
	"SCOffline":                   267,
	"SCReloginRequired":           274,
	"SCResolutionFailed":          275,
	"SCProfileNotPublic":          276,
	"SCIdentifyFailed":            277,
	"SCTrackingBroke":             278,
	"SCWrongCryptoFormat":         279,
	"SCDecryptionError":           280,
	"SCInvalidAddress":            281,
	"SCWrongCryptoMsgType":        282,
	"SCNoSession":                 283,
	"SCAccountReset":              290,
	"SCIdentifiesFailed":          295,
	"SCNoSpaceOnDevice":           297,
	"SCMerkleClientError":         299,
	"SCMerkleUpdateRoot":          300,
	"SCBadEmail":                  472,
	"SCRateLimit":                 602,
	"SCBadSignupUsernameTaken":    701,
	"SCDuplicate":                 706,
	"SCBadInvitationCode":         707,
	"SCBadSignupUsernameReserved": 710,
	"SCBadSignupTeamName":         711,
	"SCFeatureFlag":               712,
	"SCEmailTaken":                713,
	"SCEmailAlreadyAdded":         714,
	"SCEmailLimitExceeded":        715,
	"SCEmailCannotDeletePrimary":  716,
	"SCEmailUnknown":              717,
	"SCBotSignupTokenNotFound":    719,
	"SCNoUpdate":                  723,
	"SCMissingResult":             801,
	"SCKeyNotFound":               901,
	"SCKeyCorrupted":              905,
	"SCKeyInUse":                  907,
	"SCKeyBadGen":                 913,
	"SCKeyNoSecret":               914,
	"SCKeyBadUIDs":                915,
	"SCKeyNoActive":               916,
	"SCKeyNoSig":                  917,
	"SCKeyBadSig":                 918,
	"SCKeyBadEldest":              919,
	"SCKeyNoEldest":               920,
	"SCKeyDuplicateUpdate":        921,
	"SCSibkeyAlreadyExists":       922,
	"SCDecryptionKeyNotFound":     924,
	"SCVerificationKeyNotFound":   925,
	"SCKeyNoPGPEncryption":        927,
	"SCKeyNoNaClEncryption":       928,
	"SCKeySyncedPGPNotFound":      929,
	"SCKeyNoMatchingGPG":          930,
	"SCKeyRevoked":                931,
	"SCSigCannotVerify":           1002,
	"SCSigWrongKey":               1008,
	"SCSigOldSeqno":               1010,
	"SCSigCreationDisallowed":     1016,
	"SCSigMissingRatchet":         1021,
	"SCSigBadTotalOrder":          1022,
	"SCBadTrackSession":           1301,
	"SCDeviceBadName":             1404,
	"SCDeviceBadStatus":           1405,
	"SCDeviceNameInUse":           1408,
	"SCDeviceNotFound":            1409,
	"SCDeviceMismatch":            1410,
	"SCDeviceRequired":            1411,
	"SCDevicePrevProvisioned":     1413,
	"SCDeviceNoProvision":         1414,
	"SCDeviceProvisionViaDevice":  1415,
	"SCRevokeCurrentDevice":       1416,
	"SCRevokeLastDevice":          1417,
	"SCDeviceProvisionOffline":    1418,
	"SCRevokeLastDevicePGP":       1419,
	"SCStreamExists":              1501,
	"SCStreamNotFound":            1502,
	"SCStreamWrongKind":           1503,
	"SCStreamEOF":                 1504,
	"SCStreamUnknown":             1505,
	"SCGenericAPIError":           1600,
	"SCAPINetworkError":           1601,
	"SCTimeout":                   1602,
	"SCKBFSClientTimeout":         1603,
	"SCProofError":                1701,
	"SCIdentificationExpired":     1702,
	"SCSelfNotFound":              1703,
	"SCBadKexPhrase":              1704,
	"SCNoUIDelegation":            1705,
	"SCNoUI":                      1706,
	"SCGPGUnavailable":            1707,
	"SCInvalidVersionError":       1800,
	"SCOldVersionError":           1801,
	"SCInvalidLocationError":      1802,
	"SCServiceStatusError":        1803,
	"SCInstallError":              1804,
	"SCLoadKextError":             1810,
	"SCLoadKextPermError":         1811,
	"SCGitInternal":               2300,
	"SCGitRepoAlreadyExists":      2301,
	"SCGitInvalidRepoName":        2302,
	"SCGitCannotDelete":           2303,
	"SCGitRepoDoesntExist":        2304,
	"SCLoginStateTimeout":         2400,
	"SCChatInternal":              2500,
	"SCChatRateLimit":             2501,
	"SCChatConvExists":            2502,
	"SCChatUnknownTLFID":          2503,
	"SCChatNotInConv":             2504,
	"SCChatBadMsg":                2505,
	"SCChatBroadcast":             2506,
	"SCChatAlreadySuperseded":     2507,
	"SCChatAlreadyDeleted":        2508,
	"SCChatTLFFinalized":          2509,
	"SCChatCollision":             2510,
	"SCIdentifySummaryError":      2511,
	"SCNeedSelfRekey":             2512,
	"SCNeedOtherRekey":            2513,
	"SCChatMessageCollision":      2514,
	"SCChatDuplicateMessage":      2515,
	"SCChatClientError":           2516,
	"SCChatNotInTeam":             2517,
	"SCChatStalePreviousState":    2518,
	"SCChatEphemeralRetentionPolicyViolatedError": 2519,
	"SCChatUsersAlreadyInConversationError":       2520,
	"SCChatBadConversationError":                  2521,
	"SCTeamBadMembership":                         2604,
	"SCTeamSelfNotOwner":                          2607,
	"SCTeamNotFound":                              2614,
	"SCTeamExists":                                2619,
	"SCTeamReadError":                             2623,
	"SCTeamWritePermDenied":                       2625,
	"SCTeamBadGeneration":                         2634,
	"SCNoOp":                                      2638,
	"SCTeamInviteBadCancel":                       2645,
	"SCTeamInviteBadToken":                        2646,
	"SCTeamInviteCompletionMissing":               2648,
	"SCTeamBadNameReservedDB":                     2650,
	"SCTeamTarDuplicate":                          2663,
	"SCTeamTarNotFound":                           2664,
	"SCTeamMemberExists":                          2665,
	"SCTeamNotReleased":                           2666,
	"SCTeamPermanentlyLeft":                       2667,
	"SCTeamNeedRootId":                            2668,
	"SCTeamHasLiveChildren":                       2669,
	"SCTeamDeleteError":                           2670,
	"SCTeamBadRootTeam":                           2671,
	"SCTeamNameConflictsWithUser":                 2672,
	"SCTeamDeleteNoUpPointer":                     2673,
	"SCTeamNeedOwner":                             2674,
	"SCTeamNoOwnerAllowed":                        2675,
	"SCTeamImplicitNoNonSbs":                      2676,
	"SCTeamImplicitBadHash":                       2677,
	"SCTeamImplicitBadName":                       2678,
	"SCTeamImplicitClash":                         2679,
	"SCTeamImplicitDuplicate":                     2680,
	"SCTeamImplicitBadOp":                         2681,
	"SCTeamImplicitBadRole":                       2682,
	"SCTeamImplicitNotFound":                      2683,
	"SCTeamBadAdminSeqnoType":                     2684,
	"SCTeamImplicitBadAdd":                        2685,
	"SCTeamImplicitBadRemove":                     2686,
	"SCTeamInviteTokenReused":                     2696,
	"SCTeamKeyMaskNotFound":                       2697,
	"SCTeamBanned":                                2702,
	"SCTeamInvalidBan":                            2703,
	"SCTeamShowcasePermDenied":                    2711,
	"SCTeamProvisionalCanKey":                     2721,
	"SCTeamProvisionalCannotKey":                  2722,
	"SCTeamFTLOutdated":                           2736,
	"SCTeamStorageWrongRevision":                  2760,
	"SCTeamStorageBadGeneration":                  2761,
	"SCTeamStorageNotFound":                       2762,
	"SCTeamContactSettingsBlock":                  2763,
	"SCTeamSeitanInviteNeedPUK":                   2770,
	"SCEphemeralKeyBadGeneration":                 2900,
	"SCEphemeralKeyUnexpectedBox":                 2901,
	"SCEphemeralKeyMissingBox":                    2902,
	"SCEphemeralKeyWrongNumberOfKeys":             2903,
	"SCEphemeralKeyMismatchedKey":                 2904,
	"SCEphemeralPairwiseMACsMissingUIDs":          2905,
	"SCEphemeralDeviceAfterEK":                    2906,
	"SCEphemeralMemberAfterEK":                    2907,
	"SCEphemeralDeviceStale":                      2908,
	"SCEphemeralUserStale":                        2909,
	"SCStellarError":                              3100,
	"SCStellarBadInput":                           3101,
	"SCStellarWrongRevision":                      3102,
	"SCStellarMissingBundle":                      3103,
	"SCStellarBadPuk":                             3104,
	"SCStellarMissingAccount":                     3105,
	"SCStellarBadPrev":                            3106,
	"SCStellarWrongPrimary":                       3107,
	"SCStellarUnsupportedCurrency":                3108,
	"SCStellarNeedDisclaimer":                     3109,
	"SCStellarDeviceNotMobile":                    3110,
	"SCStellarMobileOnlyPurgatory":                3111,
	"SCStellarIncompatibleVersion":                3112,
	"SCNISTWrongSize":                             3201,
	"SCNISTBadMode":                               3202,
	"SCNISTHashWrongSize":                         3203,
	"SCNISTSigWrongSize":                          3204,
	"SCNISTSigBadInput":                           3205,
	"SCNISTSigBadUID":                             3206,
	"SCNISTSigBadDeviceID":                        3207,
	"SCNISTSigBadNonce":                           3208,
	"SCNISTNoSigOrHash":                           3209,
	"SCNISTExpired":                               3210,
	"SCNISTSigRevoked":                            3211,
	"SCNISTKeyRevoked":                            3212,
	"SCNISTUserDeleted":                           3213,
	"SCNISTNoDevice":                              3214,
	"SCNISTSigCannot_verify":                      3215,
	"SCNISTReplay":                                3216,
	"SCNISTSigBadLifetime":                        3217,
	"SCNISTNotFound":                              3218,
	"SCNISTBadClock":                              3219,
	"SCNISTSigBadCtime":                           3220,
	"SCBadSignupUsernameDeleted":                  3221,
	"SCPhoneNumberUnknown":                        3400,
	"SCPhoneNumberAlreadyVerified":                3401,
	"SCPhoneNumberVerificationCodeExpired":        3402,
	"SCPhoneNumberWrongVerificationCode":          3403,
	"SCPhoneNumberLimitExceeded":                  3404,
	"SCNoPaperKeys":                               3605,
	"SCTeambotKeyGenerationExists":                3800,
	"SCTeambotKeyOldBoxedGeneration":              3801,
	"SCTeambotKeyBadGeneration":                   3802,
	"SCAirdropRegisterFailedMisc":                 4207,
	"SCSimpleFSNameExists":                        5101,
	"SCSimpleFSDirNotEmpty":                       5102,
	"SCSimpleFSNotExist":                          5103,
	"SCSimpleFSNoAccess":                          5104,
}

var StatusCodeRevMap = map[StatusCode]string{
	0:    "SCOk",
	100:  "SCInputError",
	101:  "SCAssertionParseError",
	201:  "SCLoginRequired",
	202:  "SCBadSession",
	203:  "SCBadLoginUserNotFound",
	204:  "SCBadLoginPassword",
	205:  "SCNotFound",
	210:  "SCThrottleControl",
	216:  "SCDeleted",
	218:  "SCGeneric",
	235:  "SCAlreadyLoggedIn",
	230:  "SCExists",
	237:  "SCCanceled",
	239:  "SCInputCanceled",
	243:  "SCBadUsername",
	267:  "SCOffline",
	274:  "SCReloginRequired",
	275:  "SCResolutionFailed",
	276:  "SCProfileNotPublic",
	277:  "SCIdentifyFailed",
	278:  "SCTrackingBroke",
	279:  "SCWrongCryptoFormat",
	280:  "SCDecryptionError",
	281:  "SCInvalidAddress",
	282:  "SCWrongCryptoMsgType",
	283:  "SCNoSession",
	290:  "SCAccountReset",
	295:  "SCIdentifiesFailed",
	297:  "SCNoSpaceOnDevice",
	299:  "SCMerkleClientError",
	300:  "SCMerkleUpdateRoot",
	472:  "SCBadEmail",
	602:  "SCRateLimit",
	701:  "SCBadSignupUsernameTaken",
	706:  "SCDuplicate",
	707:  "SCBadInvitationCode",
	710:  "SCBadSignupUsernameReserved",
	711:  "SCBadSignupTeamName",
	712:  "SCFeatureFlag",
	713:  "SCEmailTaken",
	714:  "SCEmailAlreadyAdded",
	715:  "SCEmailLimitExceeded",
	716:  "SCEmailCannotDeletePrimary",
	717:  "SCEmailUnknown",
	719:  "SCBotSignupTokenNotFound",
	723:  "SCNoUpdate",
	801:  "SCMissingResult",
	901:  "SCKeyNotFound",
	905:  "SCKeyCorrupted",
	907:  "SCKeyInUse",
	913:  "SCKeyBadGen",
	914:  "SCKeyNoSecret",
	915:  "SCKeyBadUIDs",
	916:  "SCKeyNoActive",
	917:  "SCKeyNoSig",
	918:  "SCKeyBadSig",
	919:  "SCKeyBadEldest",
	920:  "SCKeyNoEldest",
	921:  "SCKeyDuplicateUpdate",
	922:  "SCSibkeyAlreadyExists",
	924:  "SCDecryptionKeyNotFound",
	925:  "SCVerificationKeyNotFound",
	927:  "SCKeyNoPGPEncryption",
	928:  "SCKeyNoNaClEncryption",
	929:  "SCKeySyncedPGPNotFound",
	930:  "SCKeyNoMatchingGPG",
	931:  "SCKeyRevoked",
	1002: "SCSigCannotVerify",
	1008: "SCSigWrongKey",
	1010: "SCSigOldSeqno",
	1016: "SCSigCreationDisallowed",
	1021: "SCSigMissingRatchet",
	1022: "SCSigBadTotalOrder",
	1301: "SCBadTrackSession",
	1404: "SCDeviceBadName",
	1405: "SCDeviceBadStatus",
	1408: "SCDeviceNameInUse",
	1409: "SCDeviceNotFound",
	1410: "SCDeviceMismatch",
	1411: "SCDeviceRequired",
	1413: "SCDevicePrevProvisioned",
	1414: "SCDeviceNoProvision",
	1415: "SCDeviceProvisionViaDevice",
	1416: "SCRevokeCurrentDevice",
	1417: "SCRevokeLastDevice",
	1418: "SCDeviceProvisionOffline",
	1419: "SCRevokeLastDevicePGP",
	1501: "SCStreamExists",
	1502: "SCStreamNotFound",
	1503: "SCStreamWrongKind",
	1504: "SCStreamEOF",
	1505: "SCStreamUnknown",
	1600: "SCGenericAPIError",
	1601: "SCAPINetworkError",
	1602: "SCTimeout",
	1603: "SCKBFSClientTimeout",
	1701: "SCProofError",
	1702: "SCIdentificationExpired",
	1703: "SCSelfNotFound",
	1704: "SCBadKexPhrase",
	1705: "SCNoUIDelegation",
	1706: "SCNoUI",
	1707: "SCGPGUnavailable",
	1800: "SCInvalidVersionError",
	1801: "SCOldVersionError",
	1802: "SCInvalidLocationError",
	1803: "SCServiceStatusError",
	1804: "SCInstallError",
	1810: "SCLoadKextError",
	1811: "SCLoadKextPermError",
	2300: "SCGitInternal",
	2301: "SCGitRepoAlreadyExists",
	2302: "SCGitInvalidRepoName",
	2303: "SCGitCannotDelete",
	2304: "SCGitRepoDoesntExist",
	2400: "SCLoginStateTimeout",
	2500: "SCChatInternal",
	2501: "SCChatRateLimit",
	2502: "SCChatConvExists",
	2503: "SCChatUnknownTLFID",
	2504: "SCChatNotInConv",
	2505: "SCChatBadMsg",
	2506: "SCChatBroadcast",
	2507: "SCChatAlreadySuperseded",
	2508: "SCChatAlreadyDeleted",
	2509: "SCChatTLFFinalized",
	2510: "SCChatCollision",
	2511: "SCIdentifySummaryError",
	2512: "SCNeedSelfRekey",
	2513: "SCNeedOtherRekey",
	2514: "SCChatMessageCollision",
	2515: "SCChatDuplicateMessage",
	2516: "SCChatClientError",
	2517: "SCChatNotInTeam",
	2518: "SCChatStalePreviousState",
	2519: "SCChatEphemeralRetentionPolicyViolatedError",
	2520: "SCChatUsersAlreadyInConversationError",
	2521: "SCChatBadConversationError",
	2604: "SCTeamBadMembership",
	2607: "SCTeamSelfNotOwner",
	2614: "SCTeamNotFound",
	2619: "SCTeamExists",
	2623: "SCTeamReadError",
	2625: "SCTeamWritePermDenied",
	2634: "SCTeamBadGeneration",
	2638: "SCNoOp",
	2645: "SCTeamInviteBadCancel",
	2646: "SCTeamInviteBadToken",
	2648: "SCTeamInviteCompletionMissing",
	2650: "SCTeamBadNameReservedDB",
	2663: "SCTeamTarDuplicate",
	2664: "SCTeamTarNotFound",
	2665: "SCTeamMemberExists",
	2666: "SCTeamNotReleased",
	2667: "SCTeamPermanentlyLeft",
	2668: "SCTeamNeedRootId",
	2669: "SCTeamHasLiveChildren",
	2670: "SCTeamDeleteError",
	2671: "SCTeamBadRootTeam",
	2672: "SCTeamNameConflictsWithUser",
	2673: "SCTeamDeleteNoUpPointer",
	2674: "SCTeamNeedOwner",
	2675: "SCTeamNoOwnerAllowed",
	2676: "SCTeamImplicitNoNonSbs",
	2677: "SCTeamImplicitBadHash",
	2678: "SCTeamImplicitBadName",
	2679: "SCTeamImplicitClash",
	2680: "SCTeamImplicitDuplicate",
	2681: "SCTeamImplicitBadOp",
	2682: "SCTeamImplicitBadRole",
	2683: "SCTeamImplicitNotFound",
	2684: "SCTeamBadAdminSeqnoType",
	2685: "SCTeamImplicitBadAdd",
	2686: "SCTeamImplicitBadRemove",
	2696: "SCTeamInviteTokenReused",
	2697: "SCTeamKeyMaskNotFound",
	2702: "SCTeamBanned",
	2703: "SCTeamInvalidBan",
	2711: "SCTeamShowcasePermDenied",
	2721: "SCTeamProvisionalCanKey",
	2722: "SCTeamProvisionalCannotKey",
	2736: "SCTeamFTLOutdated",
	2760: "SCTeamStorageWrongRevision",
	2761: "SCTeamStorageBadGeneration",
	2762: "SCTeamStorageNotFound",
	2763: "SCTeamContactSettingsBlock",
	2770: "SCTeamSeitanInviteNeedPUK",
	2900: "SCEphemeralKeyBadGeneration",
	2901: "SCEphemeralKeyUnexpectedBox",
	2902: "SCEphemeralKeyMissingBox",
	2903: "SCEphemeralKeyWrongNumberOfKeys",
	2904: "SCEphemeralKeyMismatchedKey",
	2905: "SCEphemeralPairwiseMACsMissingUIDs",
	2906: "SCEphemeralDeviceAfterEK",
	2907: "SCEphemeralMemberAfterEK",
	2908: "SCEphemeralDeviceStale",
	2909: "SCEphemeralUserStale",
	3100: "SCStellarError",
	3101: "SCStellarBadInput",
	3102: "SCStellarWrongRevision",
	3103: "SCStellarMissingBundle",
	3104: "SCStellarBadPuk",
	3105: "SCStellarMissingAccount",
	3106: "SCStellarBadPrev",
	3107: "SCStellarWrongPrimary",
	3108: "SCStellarUnsupportedCurrency",
	3109: "SCStellarNeedDisclaimer",
	3110: "SCStellarDeviceNotMobile",
	3111: "SCStellarMobileOnlyPurgatory",
	3112: "SCStellarIncompatibleVersion",
	3201: "SCNISTWrongSize",
	3202: "SCNISTBadMode",
	3203: "SCNISTHashWrongSize",
	3204: "SCNISTSigWrongSize",
	3205: "SCNISTSigBadInput",
	3206: "SCNISTSigBadUID",
	3207: "SCNISTSigBadDeviceID",
	3208: "SCNISTSigBadNonce",
	3209: "SCNISTNoSigOrHash",
	3210: "SCNISTExpired",
	3211: "SCNISTSigRevoked",
	3212: "SCNISTKeyRevoked",
	3213: "SCNISTUserDeleted",
	3214: "SCNISTNoDevice",
	3215: "SCNISTSigCannot_verify",
	3216: "SCNISTReplay",
	3217: "SCNISTSigBadLifetime",
	3218: "SCNISTNotFound",
	3219: "SCNISTBadClock",
	3220: "SCNISTSigBadCtime",
	3221: "SCBadSignupUsernameDeleted",
	3400: "SCPhoneNumberUnknown",
	3401: "SCPhoneNumberAlreadyVerified",
	3402: "SCPhoneNumberVerificationCodeExpired",
	3403: "SCPhoneNumberWrongVerificationCode",
	3404: "SCPhoneNumberLimitExceeded",
	3605: "SCNoPaperKeys",
	3800: "SCTeambotKeyGenerationExists",
	3801: "SCTeambotKeyOldBoxedGeneration",
	3802: "SCTeambotKeyBadGeneration",
	4207: "SCAirdropRegisterFailedMisc",
	5101: "SCSimpleFSNameExists",
	5102: "SCSimpleFSDirNotEmpty",
	5103: "SCSimpleFSNotExist",
	5104: "SCSimpleFSNoAccess",
}

func (e StatusCode) String() string {
	if v, ok := StatusCodeRevMap[e]; ok {
		return v
	}
	return fmt.Sprintf("%v", int(e))
}

type ConstantsInterface interface {
}

func ConstantsProtocol(i ConstantsInterface) rpc.Protocol {
	return rpc.Protocol{
		Name:    "keybase.1.constants",
		Methods: map[string]rpc.ServeHandlerDescription{},
	}
}

type ConstantsClient struct {
	Cli rpc.GenericClient
}
