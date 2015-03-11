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
  //return [NSColor colorWithRed:87.0/255.0 green:153.0/255.0 blue:220.0/255.0 alpha:1.0f];
  //return [NSColor colorWithRed:0.0f green:0.49f blue:0.96f alpha:1.0f];
  //return GHNSColorFromRGB(0x286090);
  //return [NSColor colorWithRed:9.0/255.0 green:80.0/255.0 blue:208.0/255.0 alpha:1.0f];
  return [NSColor colorWithRed:50.0/255.0 green:132.0/255.0 blue:252.0/255.0 alpha:1.0f];
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

- (NSColor *)secondaryLineColor {
  return [NSColor colorWithCalibratedWhite:213.0/255.0 alpha:1.0];
}

- (NSColor *)tableGridColor {
  return [self secondaryLineColor];
}

- (NSColor *)highlightBackgroundColor {
  return [NSColor colorWithCalibratedRed:8.0/255.0 green:80.0/255.0 blue:208.0/255.0 alpha:1.0];
  //return [NSColor colorWithCalibratedRed:231.0/255.0 green:239.0/255.0 blue:255.0/255.0 alpha:1.0];
}

#define BASE_FONT_SIZE (13)

- (NSFont *)textFont {
  return [NSFont systemFontOfSize:BASE_FONT_SIZE];
}

- (NSFont *)smallTextFont {
  return [NSFont systemFontOfSize:BASE_FONT_SIZE-1];
}

- (NSFont *)boldTextFont {
  return [NSFont boldSystemFontOfSize:BASE_FONT_SIZE];
}

- (NSFont *)boldLargeTextFont {
  return [NSFont boldSystemFontOfSize:BASE_FONT_SIZE+2];
}

- (NSFont *)boldLargerTextFont {
  return [NSFont boldSystemFontOfSize:BASE_FONT_SIZE+4];
}

- (NSFont *)buttonFont {
  return [NSFont systemFontOfSize:BASE_FONT_SIZE+4];
}

- (NSColor *)backgroundColor {
  return NSColor.whiteColor;
}

- (NSColor *)secondaryBackgroundColor {
  return [NSColor colorWithCalibratedWhite:0.966 alpha:1.0];
}

@end
