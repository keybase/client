//
//  KBIcons.m
//  Keybase
//
//  Created by Gabriel on 4/23/15.
//  Copyright (c) 2015 Gabriel Handford. All rights reserved.
//

#import "KBIcons.h"

@interface KBIcons ()
@property NSBundle *bundle;
@end

@implementation KBIcons

- (instancetype)init {
  if ((self = [super init])) {
    // Apple System icons from /System/Library/CoreServices/CoreTypes.bundle/Contents/Resources/
    _bundle = [NSBundle bundleWithPath:@"/System/Library/CoreServices/CoreTypes.bundle"];
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
  NSString *localBundleName = nil;
  switch (icon) {
    case KBIconUserIcon: coreBundleName = @"UserIcon.icns"; break; // Single head
    case KBIconUsers: coreBundleName = @"GroupIcon.icns"; break; // Two heads
    case KBIconGroupFolder: coreBundleName = @"GroupFolder.icns"; break; // Folder with heads
    case KBIconHomeFolder: coreBundleName = @"HomeFolderIcon.icns"; break; // House
    case KBIconMacbook: coreBundleName = @"com.apple.macbookpro-15-retina-display.icns"; break;
    case KBIconGenericApp: coreBundleName = @"GenericApplicationIcon.icns"; break;
    case KBIconNetwork: coreBundleName = @"GenericNetworkIcon.icns"; break;
    case KBIconExecutableBinary: coreBundleName = @"ExecutableBinaryIcon.icns"; break;
    case KBIconAlertNote: coreBundleName = @"AlertNoteIcon.icns"; break;
    case KBIconExtension: coreBundleName = @"KEXT.icns"; break;

    case KBIconPGP: localBundleName = @"gpgtools.icns"; break;
    case KBIconFuse: localBundleName = @"Fuse.icns"; break;
  }

  if (coreBundleName) {
    return [[NSImage alloc] initWithContentsOfFile:[_bundle pathForImageResource:coreBundleName]];
  } else if (localBundleName) {
    return [NSImage imageNamed:localBundleName];
  } else {
    return nil;
  }
}

- (NSImage *)imageForIcon:(KBIcon)icon size:(CGSize)size {
  NSImage *image = [self imageForIcon:icon];
  image.size = size;
  return image;
}

@end
