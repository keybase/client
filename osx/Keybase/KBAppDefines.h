//
//  KBAppDefines.h
//  Keybase
//
//  Created by Gabriel on 12/16/14.
//  Copyright (c) 2014 Gabriel Handford. All rights reserved.
//

#import <GHKit/GHKit.h>
#import <ObjectiveSugar/ObjectiveSugar.h>
#import <YOLayout/YOLayout.h>
#import <YOLayout/YOBox.h>
#import <YOLayout/YOBorderLayout.h>
#import <CocoaLumberjack/CocoaLumberjack.h>
#import <GHODictionary/GHODictionary.h>
#import <KBAppKit/KBAppKit.h>

#import "KBDefines.h"
#import "KBFormatter.h"

extern NSString *const KBTrackingListDidChangeNotification;
extern NSString *const KBUserDidChangeNotification;
extern NSString *const KBStatusDidChangeNotification;

NSString *KBDisplayURLStringForUsername(NSString *username);
NSString *KBURLStringForUsername(NSString *username);

NSString *KBPGPKeyIdFromFingerprint(NSString *fingerprint);

NSString *KBDescriptionForKID(NSData *kid);
NSString *KBDescriptionForFingerprint(NSString *fingerprint, NSInteger indexForLineBreak);

BOOL KBIsErrorName(NSError *error, NSString *name);

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

#undef KBLog
#define KBLog DDLogDebug

NSString *KBNSStringByStrippingHTML(NSString *str);


void KBConvertArrayTo(NSMutableArray *array);
void KBConvertArrayFrom(NSMutableArray *array);

void KBConvertDictTo(NSMutableDictionary *dict);
void KBConvertDictFrom(NSMutableDictionary *dict);

typedef id (^KBCoverter)(id obj);
void KBConvertArray(NSMutableArray *array, Class clazz, KBCoverter converter);
void KBConvertDict(NSMutableDictionary *dict, Class clazz, KBCoverter converter);
id KBConvertObject(id item, Class clazz, KBCoverter converter);


