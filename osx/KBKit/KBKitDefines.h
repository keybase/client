//
//  KBKitImports.h
//  Keybase
//
//  Created by Gabriel on 12/16/14.
//  Copyright (c) 2014 Gabriel Handford. All rights reserved.
//

NSString *KBDisplayURLStringForUsername(NSString *username);
NSString *KBURLStringForUsername(NSString *username);

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

#undef KBLog
#define KBLog DDLogDebug

