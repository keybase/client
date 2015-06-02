//
//  KBIcons.h
//  Keybase
//
//  Created by Gabriel on 4/23/15.
//  Copyright (c) 2015 Gabriel Handford. All rights reserved.
//

#import <Foundation/Foundation.h>

#import <AppKit/AppKit.h>

typedef NS_ENUM(NSInteger, KBIcon) {
  KBIconUserIcon = 1,
  KBIconUsers,
  KBIconGroupFolder,
  KBIconHomeFolder,
  KBIconMacbook,
  KBIconGenericApp,
  KBIconNetwork,
  KBIconExecutableBinary,
  KBIconAlertNote,
  KBIconExtension,

  KBIconPGP,
  KBIconFuse,
};

@interface KBIcons : NSObject

+ (instancetype)icons;

+ (NSImage *)imageForIcon:(KBIcon)icon;

- (NSImage *)imageForIcon:(KBIcon)icon size:(CGSize)size;

@end
