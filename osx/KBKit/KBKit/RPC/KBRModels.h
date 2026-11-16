//
//  KBRModels.h
//  KBKit
//
//  Models for the JSON that `keybase launchd status` and `keybase fuse status`
//  print (keybase1.ServiceStatus and keybase1.FuseStatus in protocol/avdl).
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

@interface KBRStringKVPair : KBRObject
@property NSString *key;
@property NSString *value;
@end

@interface KBRStatus : KBRObject
@property NSInteger code;
@property NSString *name;
@property NSString *desc;
@property NSArray *fields; /*of KBRStringKVPair*/
@end

@interface KBRServiceStatus : KBRObject
@property NSString *version;
@property NSString *label;
@property NSString *pid;
@property NSString *lastExitStatus;
@property NSString *bundleVersion;
@property KBRInstallStatus installStatus;
@property KBRInstallAction installAction;
@property KBRStatus *status;
@end

@interface KBRFuseMountInfo : KBRObject
@property NSString *path;
@property NSString *fstype;
@property NSString *output;
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
