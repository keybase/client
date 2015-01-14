//
//  KBLookAndFeel.m
//  Keybase
//
//  Created by Gabriel on 1/8/15.
//  Copyright (c) 2015 Gabriel Handford. All rights reserved.
//

#import "KBLookAndFeel.h"

#import "KBDefines.h"

/*!
 Macro for UIColor from hex.
 NSColor *color = GHNSColorFromRGB(0xBC1128);
 */
#define GHNSColorFromRGB(rgbValue) [NSColor colorWithRed:((float)((rgbValue & 0xFF0000) >> 16))/255.0 green:((float)((rgbValue & 0xFF00) >> 8))/255.0 blue:((float)(rgbValue & 0xFF))/255.0 alpha:1.0]


@implementation KBLookAndFeel

+ (NSColor *)textColor {
  return GHNSColorFromRGB(0x333333);
}

+ (NSColor *)secondaryTextColor {
  return GHNSColorFromRGB(0x666666);
}

+ (NSColor *)selectColor {
  return [NSColor colorWithRed:0.0f green:0.49f blue:0.96f alpha:1.0f];
}

+ (NSColor *)disabledTextColor {
  return GHNSColorFromRGB(0x999999);
}

+ (NSFont *)textFont {
  return [NSFont systemFontOfSize:14];
}

+ (NSFont *)boldTextFont {
  return [NSFont boldSystemFontOfSize:14];
}

+ (NSFont *)buttonFont {
  return [NSFont systemFontOfSize:18];
}

@end
