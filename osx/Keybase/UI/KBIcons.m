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


- (NSString *)nameForIcon:(KBIcon)icon {
  switch (icon) {
    case KBIconUserIcon: return @"UserIcon.icns"; // Single head
    case KBIconUsers: return @"GroupIcon.icns"; // Two heads
    case KBIconGroupFolder: return @"GroupFolder.icns"; // Folder with heads
    case KBIconHomeFolder: return @"HomeFolderIcon.icns"; // House
    case KBIconMacbook: return @"com.apple.macbookpro-15-retina-display.icns";
  }
}

- (NSImage *)imageForIcon:(KBIcon)icon size:(CGSize)size {
  NSImage *image = [[NSImage alloc] initWithContentsOfFile:[_bundle pathForImageResource:[self nameForIcon:icon]]];
  image.size = size;
  return image;
}

@end
