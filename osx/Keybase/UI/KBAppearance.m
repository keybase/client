//
//  KBAppearance.m
//  KBAppKit
//
//  Created by Gabriel on 2/20/15.
//  Copyright (c) 2015 KBAppKit. All rights reserved.
//

#import "KBAppearance.h"

@implementation KBAppearance

static id<KBAppearance> gCurrentAppearance = NULL;

+ (void)setCurrentAppearance:(id<KBAppearance>)appearance {
  gCurrentAppearance = appearance;
}

+ (id<KBAppearance>)currentAppearance {
  if (!gCurrentAppearance) return self.lightAppearance;
  return gCurrentAppearance;
}

+ (id<KBAppearance>)lightAppearance {
  static dispatch_once_t onceToken;
  static id<KBAppearance> gLightAppearance = NULL;
  dispatch_once(&onceToken, ^{
    gLightAppearance = [[KBAppearanceLight alloc] init];
  });
  return gLightAppearance;
}

+ (id<KBAppearance>)darkAppearance {
  static dispatch_once_t onceToken;
  static id<KBAppearance> gDarkAppearance = NULL;
  dispatch_once(&onceToken, ^{
    gDarkAppearance = [[KBAppearanceDark alloc] init];
  });
  return gDarkAppearance;
}

@end

@implementation KBAppearanceDark

- (NSColor *)textColor {
  return GHNSColorFromRGB(0xFFFFFF);
}

- (NSColor *)secondaryTextColor {
  return GHNSColorFromRGB(0xEEEEEE);
}

- (NSColor *)disabledTextColor {
  return GHNSColorFromRGB(0x666666);
}

- (NSColor *)backgroundColor {
  return NSColor.blackColor;
}

- (NSColor *)secondaryBackgroundColor {
  return [NSColor colorWithCalibratedWhite:0.05 alpha:1.0];
}

@end

@implementation KBAppearanceLight

- (NSColor *)textColor {
  return GHNSColorFromRGB(0x333333);
}

- (NSColor *)secondaryTextColor {
  return GHNSColorFromRGB(0x666666);
}

- (NSColor *)selectColor {
  return [NSColor colorWithRed:87.0/255.0 green:153.0/255.0 blue:220.0/255.0 alpha:1.0f];
  //return [NSColor colorWithRed:0.0f green:0.49f blue:0.96f alpha:1.0f];
  //return GHNSColorFromRGB(0x286090);
}

- (NSColor *)disabledTextColor {
  return GHNSColorFromRGB(0x999999);
}

- (NSColor *)selectedTextColor {
  return NSColor.whiteColor;
}

- (NSColor *)greenColor {
  return [NSColor colorWithRed:9.0/255.0 green:179.0/255.0 blue:18.0/255.0 alpha:1.0f];
}

- (NSColor *)okColor {
  return [self greenColor];
}

- (NSColor *)warnColor {
  return [NSColor colorWithRed:1.0f green:0.58f blue:0.19f alpha:1.0f];
}

- (NSColor *)errorColor {
  return [NSColor colorWithRed:1.0f green:0.22f blue:0.22f alpha:1.0f];
}

- (NSColor *)lineColor {
  return [NSColor colorWithCalibratedWhite:193.0/255.0 alpha:1.0];
}

- (NSColor *)highlightBackgroundColor {
  return [NSColor colorWithCalibratedRed:8.0/255.0 green:80.0/255.0 blue:208.0/255.0 alpha:1.0];
  //return [NSColor colorWithCalibratedRed:231.0/255.0 green:239.0/255.0 blue:255.0/255.0 alpha:1.0];
}

- (NSFont *)textFont {
  return [NSFont systemFontOfSize:14];
}

- (NSFont *)smallTextFont {
  return [NSFont systemFontOfSize:13];
}

- (NSFont *)boldTextFont {
  return [NSFont boldSystemFontOfSize:14];
}

- (NSFont *)boldLargeTextFont {
  return [NSFont boldSystemFontOfSize:20];
}

- (NSFont *)buttonFont {
  return [NSFont systemFontOfSize:18];
}

- (NSColor *)backgroundColor {
  return NSColor.whiteColor;
}

- (NSColor *)secondaryBackgroundColor {
  return [NSColor colorWithCalibratedWhite:0.966 alpha:1.0];
}

@end
