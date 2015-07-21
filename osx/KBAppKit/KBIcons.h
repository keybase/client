//
//  KBIcons.h
//  Keybase
//
//  Created by Gabriel on 4/23/15.
//  Copyright (c) 2015 Gabriel Handford. All rights reserved.
//

#import <Foundation/Foundation.h>

@import AppKit;

typedef NS_ENUM(NSInteger, KBIcon) {
  KBIconUserIcon = 1,
  KBIconUsers,
  KBIconGroupFolder,
  KBIconHomeFolder,
  KBIconFileVault,
  KBIconMacbook,
  KBIconGenericApp,
  KBIconExecutableBinary,
  KBIconAlertNote,
  KBIconExtension,
  KBIconNotifications,
  KBIconColors,
  KBIconLocked,

  KBIconComputer,
  KBIconNetwork,

  KBIconPGP,
  KBIconFuse,
};

@interface KBIcons : NSObject

+ (instancetype)icons;

+ (NSImage *)imageForIcon:(KBIcon)icon;

- (NSImage *)imageForIcon:(KBIcon)icon size:(CGSize)size;

@end
