//
//  KBDefines.h
//  Keybase
//
//  Created by Gabriel on 12/16/14.
//  Copyright (c) 2014 Gabriel Handford. All rights reserved.
//

#import <GHKit/GHKit.h>
#import <ObjectiveSugar/ObjectiveSugar.h>
#import <YOLayout/YOLayout.h>
#import <CocoaLumberjack/CocoaLumberjack.h>

typedef void (^KBCompletionBlock)(NSError *error);
typedef void (^KBErrorBlock)(NSError *error);

#define KBMakeError(CODE, MSG, ...) [NSError errorWithDomain:@"Keybase" code:CODE userInfo:@{NSLocalizedDescriptionKey:[NSString stringWithFormat:MSG, ##__VA_ARGS__], NSLocalizedRecoveryOptionsErrorKey: @[@"OK"]}]

#define KBMakeErrorWithRecovery(CODE, MSG, RECOVERY, ...) [NSError errorWithDomain:@"Keybase" code:CODE userInfo:@{NSLocalizedDescriptionKey: MSG, NSLocalizedRecoveryOptionsErrorKey: @[@"OK"], NSLocalizedRecoverySuggestionErrorKey:[NSString stringWithFormat:RECOVERY, ##__VA_ARGS__]}]

extern NSString *const KBTrackingListDidChangeNotification;
extern NSString *const KBStatusDidChangeNotification;

NSString *KBDisplayURLStringForUsername(NSString *username);
NSString *KBURLStringForUsername(NSString *username);

NSString *KBHexString(NSData *data);
NSData *KBHexData(NSString *s);

NSString *KBDescription(id obj);
NSString *KBDictionaryDescription(NSDictionary *d);
NSString *KBArrayDescription(NSArray *a);

NSString *KBPGPKeyIdFromFingerprint(NSString *fingerprint);

NSString *KBDescriptionForKID(NSData *kid);
NSString *KBDescriptionForFingerprint(NSString *fingerprint, NSInteger indexForLineBreak);

typedef NS_ENUM (NSInteger, KBAppViewItem) {
  KBAppViewItemNone,
  KBAppViewItemProfile = 1,
  KBAppViewItemUsers,
  KBAppViewItemDevices,
  KBAppViewItemFolders,
  KBAppViewItemPGP,
};


#define KBErrorAlert(fmt, ...) [NSError errorWithDomain:@"Keybase" code:-1 userInfo:@{NSLocalizedDescriptionKey:[NSString stringWithFormat:fmt, ##__VA_ARGS__], NSLocalizedRecoveryOptionsErrorKey:@[@"OK"]}]


#define KBMap(ARRAY, PROPERTY) [ARRAY map:^(id obj) { return [obj PROPERTY]; }]