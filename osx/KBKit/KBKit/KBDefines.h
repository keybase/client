//
//  KBDefines.h
//  Keybase
//
//  Created by Gabriel on 5/13/15.
//  Copyright (c) 2015 Gabriel Handford. All rights reserved.
//

#import <Foundation/Foundation.h>

#import <GHKit/GHKit.h>
#import <ObjectiveSugar/ObjectiveSugar.h>

#import <CocoaLumberjack/CocoaLumberjack.h>
static const int ddLogLevel = DDLogLevelDebug;

typedef void (^KBCompletion)(NSError *error);
typedef void (^KBOnCompletion)(NSError *error, id value);
typedef void (^KBOnExtension)(id sender, NSExtensionItem *outputItem);
typedef void (^KBOnTarget)(id sender);

typedef NS_ENUM (NSInteger, KBErrorCode) {
  KBErrorCodeWarning = 0,
  KBErrorCodeGeneric = -1,
  KBErrorCodeUnsupported = -10,
  KBErrorCodePermissionDenied = -11,

  KBErrorCodeInstallError = -101,
  KBErrorCodePathNotFound = -102,
  KBErrorCodePathInaccessible = -103,

  KBErrorCodeAlreadyOpening = -201,
  KBErrorCodeAlreadyOpen = -202,
  KBErrorCodeTimeout = -210,
};

typedef NS_ENUM (NSInteger, KBErrorResponse) {
  KBErrorResponseNone,
  KBErrorResponseRetry,

  // The error is ignored if it is was a cancelation error, or
  // an error is already showing.
  KBErrorResponseIgnored,
};

#define KBMakeError(CODE, MSG, ...) [NSError errorWithDomain:@"Keybase" code:CODE userInfo:@{NSLocalizedDescriptionKey:[NSString stringWithFormat:MSG, ##__VA_ARGS__], NSLocalizedRecoveryOptionsErrorKey: @[@"OK"]}]

#define KBMakeErrorWithRecovery(CODE, MSG, RECOVERY, ...) [NSError errorWithDomain:@"Keybase" code:CODE userInfo:@{NSLocalizedDescriptionKey: MSG, NSLocalizedRecoveryOptionsErrorKey: @[@"OK"], NSLocalizedRecoverySuggestionErrorKey:[NSString stringWithFormat:RECOVERY, ##__VA_ARGS__]}]

#define KBMakeWarning(MSG, ...) KBMakeError(KBErrorCodeWarning, MSG, ##__VA_ARGS__)
#define KBIsWarning(ERR) ((ERR.code == KBErrorCodeWarning))


#define KBOrNull(obj) (obj ? obj : NSNull.null)
#define KBOr(obj, dv) (obj ? obj : dv)
#define KBIfNull(obj, val) ([obj isEqual:NSNull.null] ? val : obj)
#define KBIfBlank(s, dv) ((!s || [s isEqualToString:@""]) ? dv : s)

#define KBErrorAlert(fmt, ...) [NSError errorWithDomain:@"Keybase" code:-1 userInfo:@{NSLocalizedDescriptionKey:[NSString stringWithFormat:fmt, ##__VA_ARGS__], NSLocalizedRecoveryOptionsErrorKey:@[@"OK"]}]


#define KBMap(ARRAY, PROPERTY) [ARRAY map:^(id obj) { return [obj PROPERTY]; }]

#define KBAppGroupId (@"keybase")

NSNumber *KBNumberFromString(NSString *s);

NSString *KBNSStringWithFormat(NSString *formatString, ...);

NSString *KBNSStringByStrippingHTML(NSString *str);

BOOL KBIsErrorName(NSError *error, NSString *name);


NSString *KBDisplayURLStringForUsername(NSString *username);
NSString *KBURLStringForUsername(NSString *username);

NSString *KBPGPKeyIdFromFingerprint(NSString *fingerprint);

NSString *KBDescriptionForKID(NSData *kid);
NSString *KBDescriptionForFingerprint(NSString *fingerprint, NSInteger indexForLineBreak);


typedef NS_ENUM (NSInteger, KBProofAction) {
  KBProofActionCancel = 0,
  KBProofActionRetry,
  KBProofActionReplace,
  KBProofActionRevoke,
  KBProofActionOpen,
  KBProofActionView,
  KBProofActionRepair,
};

NSString *KBImageNameForServiceName(NSString *serviceName);

NSString *KBShortNameForServiceName(NSString *serviceName);

NSString *KBNameForServiceName(NSString *serviceName);


