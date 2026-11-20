//
//  KBRModels.h
//  KBKit
//
//  Models for the JSON that `keybase fuse status` prints (keybase1.FuseStatus
//  in protocol/avdl).
//

#import "KBRObject.h"

typedef NS_ENUM (NSInteger, KBRInstallStatus) {
	KBRInstallStatusUnknown = 0,
	KBRInstallStatusError = 1,
	KBRInstallStatusNotInstalled = 2,
	KBRInstallStatusInstalled = 4,
};

typedef NS_ENUM (NSInteger, KBRInstallAction) {
	KBRInstallActionUnknown = 0,
	KBRInstallActionNone = 1,
	KBRInstallActionUpgrade = 2,
	KBRInstallActionReinstall = 3,
	KBRInstallActionInstall = 4,
};

@interface KBRStatus : KBRObject
@property NSInteger code;
@property NSString *desc;
@end

@interface KBRFuseMountInfo : KBRObject
@property NSString *fstype;
@end

@interface KBRFuseStatus : KBRObject
@property NSString *version;
@property NSString *bundleVersion;
@property NSString *kextID;
@property NSString *path;
@property BOOL kextStarted;
@property KBRInstallStatus installStatus;
@property KBRInstallAction installAction;
@property NSArray *mountInfos; /*of KBRFuseMountInfo*/
@property KBRStatus *status;
@end
