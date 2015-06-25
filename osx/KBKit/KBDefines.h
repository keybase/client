//
//  KBDefines.h
//  Keybase
//
//  Created by Gabriel on 5/13/15.
//  Copyright (c) 2015 Gabriel Handford. All rights reserved.
//

#import <Foundation/Foundation.h>

typedef void (^KBCompletion)(NSError *error);
typedef void (^KBOnCompletion)(NSError *error, id value);
typedef void (^KBOnExtension)(id sender, NSExtensionItem *outputItem);

#define KBMakeError(CODE, MSG, ...) [NSError errorWithDomain:@"Keybase" code:CODE userInfo:@{NSLocalizedDescriptionKey:[NSString stringWithFormat:MSG, ##__VA_ARGS__], NSLocalizedRecoveryOptionsErrorKey: @[@"OK"]}]

#define KBMakeErrorWithRecovery(CODE, MSG, RECOVERY, ...) [NSError errorWithDomain:@"Keybase" code:CODE userInfo:@{NSLocalizedDescriptionKey: MSG, NSLocalizedRecoveryOptionsErrorKey: @[@"OK"], NSLocalizedRecoverySuggestionErrorKey:[NSString stringWithFormat:RECOVERY, ##__VA_ARGS__]}]


#define KBOrNull(obj) (obj ? obj : NSNull.null)
#define KBOr(obj, dv) (obj ? obj : dv)
#define KBIfNull(obj, val) ([obj isEqual:NSNull.null] ? val : obj)


#define KBErrorAlert(fmt, ...) [NSError errorWithDomain:@"Keybase" code:-1 userInfo:@{NSLocalizedDescriptionKey:[NSString stringWithFormat:fmt, ##__VA_ARGS__], NSLocalizedRecoveryOptionsErrorKey:@[@"OK"]}]


#define KBMap(ARRAY, PROPERTY) [ARRAY map:^(id obj) { return [obj PROPERTY]; }]

#define KBAppGroupId (@"keybase")

NSNumber *KBNumberFromString(NSString *s);

NSString *KBNSStringWithFormat(NSString *formatString, ...);

NSString *KBPath(NSString *path, BOOL tilde, BOOL escape);

// Return path in directory (if directory is nil returns nil)
NSString *KBPathInDir(NSString *dir, NSString *path, BOOL tilde, BOOL escape);

NSURL *KBURLPath(NSString *path, BOOL isDir, BOOL tilde, BOOL escape);

NSString *KBNSStringByStrippingHTML(NSString *str);

#define LINK_SOURCE (@"/usr/local/bin/keybase")

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
  KBProofActionOpen
};

NSString *KBImageNameForServiceName(NSString *serviceName);

NSString *KBShortNameForServiceName(NSString *serviceName);

NSString *KBNameForServiceName(NSString *serviceName);
