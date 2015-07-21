//
//  KBIcons.m
//  Keybase
//
//  Created by Gabriel on 4/23/15.
//  Copyright (c) 2015 Gabriel Handford. All rights reserved.
//

#import "KBIcons.h"
#import "KBImage.h"

@interface KBIcons ()
@property NSBundle *coreBundle;
@end

@implementation KBIcons

- (instancetype)init {
  if ((self = [super init])) {
    _coreBundle = [NSBundle bundleWithPath:@"/System/Library/CoreServices/CoreTypes.bundle"];
  }
  return self;
}

+ (instancetype)icons {
  static dispatch_once_t onceToken;
  static KBIcons *gIcons = NULL;
  dispatch_once(&onceToken, ^{
    gIcons = [[KBIcons alloc] init];
  });
  return gIcons;
}

+ (NSImage *)imageForIcon:(KBIcon)icon {
  return [KBIcons.icons imageForIcon:icon];
}

- (NSImage *)imageForIcon:(KBIcon)icon {
  NSString *coreBundleName = nil;
  NSString *bundleName = nil;
  //NSColor *tintColor = nil;
  switch (icon) {
    // Apple System icons from /System/Library/CoreServices/CoreTypes.bundle/Contents/Resources/
    case KBIconUserIcon: coreBundleName = @"UserIcon.icns"; break; // Single head
    case KBIconUsers: coreBundleName = @"GroupIcon.icns"; break; // Two heads
    case KBIconGroupFolder: coreBundleName = @"GroupFolder.icns"; break; // Folder with heads
    case KBIconHomeFolder: coreBundleName = @"HomeFolderIcon.icns"; break; // House
    case KBIconFileVault: coreBundleName = @"FileVaultIcon.icns"; break; // Color wheel
    case KBIconMacbook: coreBundleName = @"com.apple.macbookpro-15-retina-display.icns"; break;
    case KBIconGenericApp: coreBundleName = @"GenericApplicationIcon.icns"; break; // Default App Icon
    case KBIconExecutableBinary: coreBundleName = @"ExecutableBinaryIcon.icns"; break; // Terminal
    case KBIconAlertNote: coreBundleName = @"AlertNoteIcon.icns"; break; // Speech bubble
    case KBIconExtension: coreBundleName = @"KEXT.icns"; break; // Lego piece
    case KBIconNotifications: coreBundleName = @"Notifiations.icns"; break; // Red dot
    case KBIconColors: coreBundleName = @"ProfileBackgroundColor.icns"; break; // Color wheel
    case KBIconLocked: coreBundleName = @"LockedIcon.icns"; break; // Color wheel

    // Bundle (system)
    case KBIconComputer: bundleName = NSImageNameComputer; break;
    case KBIconNetwork: bundleName = NSImageNameNetwork; break;
      //case KBIconNetwork: coreBundleName = @"GenericNetworkIcon.icns"; break; // Round ball network

    // Local bundle
    case KBIconPGP: bundleName = @"gpgtools.icns"; break;
    case KBIconFuse: bundleName = @"Fuse.icns"; break;
  }

  NSImage *image = nil;
  if (coreBundleName) {
    image = [[NSImage alloc] initWithContentsOfFile:[_coreBundle pathForImageResource:coreBundleName]];
  } else if (bundleName) {
    image = [NSImage imageNamed:bundleName];
  }

// Tinting this way looks bad
//  if (image && tintColor) {
//    image = [image kb_imageTintedWithColor:tintColor];
//  }

  return image;
}

- (NSImage *)imageForIcon:(KBIcon)icon size:(CGSize)size {
  NSImage *image = [self imageForIcon:icon];
  image.size = size;
  return image;
}

@end
