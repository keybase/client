//
//  KBAppearance.m
//  KBAppKit
//
//  Created by Gabriel on 2/20/15.
//  Copyright (c) 2015 KBAppKit. All rights reserved.
//

#import "KBAppearance.h"
#import "KBAppKitDefines.h"

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

@implementation KBAppearanceLight

- (NSColor *)colorForStyle:(KBTextStyle)style {
  switch (style) {
    case KBTextStyleNone:
    case KBTextStyleDefault:
    case KBTextStyleHeader:
    case KBTextStyleHeaderLarge:
      return self.textColor;

    case KBTextStyleSecondaryText:
      return self.secondaryTextColor;

    case KBTextStyleMonospace:
      return self.secondaryTextColor;
  }
}

- (NSFont *)fontForStyle:(KBTextStyle)style {
  switch (style) {
    case KBTextStyleNone:
    case KBTextStyleDefault:
      return self.textFont;

    case KBTextStyleSecondaryText: return self.textFont;
    case KBTextStyleHeader: return self.headerTextFont;
    case KBTextStyleHeaderLarge: return self.headerLargeTextFont;
    case KBTextStyleMonospace: return [NSFont fontWithName:@"Monaco" size:12];
  }
}

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
  //return [NSColor colorWithRed:50.0/255.0 green:132.0/255.0 blue:252.0/255.0 alpha:1.0f];
  return GHNSColorFromRGB(0x0084FF);
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
  return [NSColor colorWithWhite:193.0/255.0 alpha:1.0];
}

- (NSColor *)secondaryLineColor {
  return [NSColor colorWithWhite:213.0/255.0 alpha:1.0];
}

- (NSColor *)tableGridColor {
  return [self secondaryLineColor];
}

- (NSColor *)highlightBackgroundColor {
  return [NSColor colorWithRed:8.0/255.0 green:80.0/255.0 blue:208.0/255.0 alpha:1.0];
  //return [NSColor colorWithRed:231.0/255.0 green:239.0/255.0 blue:255.0/255.0 alpha:1.0];
}

#define BASE_FONT_SIZE (14)

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

- (NSFont *)headerTextFont {
  return [NSFont systemFontOfSize:BASE_FONT_SIZE+6];
}

- (NSFont *)headerLargeTextFont {
  return [NSFont fontWithName:@"Helvetica Neue Thin" size:BASE_FONT_SIZE+14];
  //return [NSFont systemFontOfSize:BASE_FONT_SIZE+10];
}

- (NSFont *)buttonFont {
  return [NSFont systemFontOfSize:BASE_FONT_SIZE+2];
}

- (NSColor *)backgroundColor {
  return NSColor.whiteColor;
}

- (NSColor *)secondaryBackgroundColor {
  return [NSColor colorWithWhite:0.966 alpha:1.0];
}

- (NSColor *)buttonTextColorForStyle:(KBButtonStyle)style enabled:(BOOL)enabled highlighted:(BOOL)highlighted {
  if (!enabled) return GHNSColorFromRGB(0x666666);
  switch (style) {
    case KBButtonStyleDefault:
    case KBButtonStyleToolbar:
    case KBButtonStyleSmall:
      return GHNSColorFromRGB(0x333333);

    case KBButtonStylePrimary:
      return GHNSColorFromRGB(0xFFFFFF);

    case KBButtonStyleLink: return highlighted ? GHNSColorFromRGB(0x000000) : [KBAppearance.currentAppearance selectColor];
    case KBButtonStyleText: NSAssert(NO, @"Text style shouldn't get here");
    case KBButtonStyleCheckbox: return GHNSColorFromRGB(0x333333);
    case KBButtonStyleEmpty: return nil;
  }
}

- (NSColor *)buttonDisabledFillColorForStyle:(KBButtonStyle)style {
  switch (style) {
    case KBButtonStyleDefault:
    case KBButtonStylePrimary:
    case KBButtonStyleToolbar:
    case KBButtonStyleSmall:
      return GHNSColorFromRGB(0xEFEFEF);

    case KBButtonStyleLink:
    case KBButtonStyleText:
    case KBButtonStyleCheckbox:
    case KBButtonStyleEmpty:
      return nil;
  }
}

- (NSColor *)buttonHighlightedFillColorForStyle:(KBButtonStyle)style {
  switch (style) {
    case KBButtonStyleEmpty:
    case KBButtonStyleDefault:
    case KBButtonStyleToolbar:
    case KBButtonStyleSmall:
    case KBButtonStyleText:
      return GHNSColorFromRGB(0xDEDEDE);

    case KBButtonStylePrimary:
      return [NSColor colorWithRed:192.0/255.0 green:221.0/255.0 blue:250.0/255.0 alpha:1.0];

    case KBButtonStyleCheckbox:
    case KBButtonStyleLink:
      return nil;
  }
}

- (NSColor *)buttonFillColorForStyle:(KBButtonStyle)style enabled:(BOOL)enabled highlighted:(BOOL)highlighted toggled:(BOOL)toggled {
  if (toggled) return [self buttonHighlightedFillColorForStyle:style];
  if (!enabled) return [self buttonDisabledFillColorForStyle:style];
  if (highlighted) return [self buttonHighlightedFillColorForStyle:style];
  switch (style) {
    case KBButtonStyleDefault:
    case KBButtonStyleToolbar:
    case KBButtonStyleSmall:
      return [NSColor colorWithWhite:0.99 alpha:1.0];

    case KBButtonStylePrimary:
      return KBAppearance.currentAppearance.selectColor;

    case KBButtonStyleEmpty:
    case KBButtonStyleLink:
    case KBButtonStyleText:
    case KBButtonStyleCheckbox:
      return nil;
  }
}

- (NSColor *)buttonDisabledStrokeColorForStyle:(KBButtonStyle)style {
  switch (style) {
    case KBButtonStyleDefault:
    case KBButtonStylePrimary:
      return GHNSColorFromRGB(0xCCCCCC);
    case KBButtonStyleLink:
    case KBButtonStyleText:
    case KBButtonStyleCheckbox:
    case KBButtonStyleEmpty:
    case KBButtonStyleToolbar:
    case KBButtonStyleSmall:
      return nil;
  }
}

- (NSColor *)buttonStrokeColorForStyle:(KBButtonStyle)style enabled:(BOOL)enabled highlighted:(BOOL)highlighted {
  if (!enabled) return [self buttonDisabledStrokeColorForStyle:style];
  switch (style) {
    case KBButtonStyleDefault:
    case KBButtonStyleToolbar:
    case KBButtonStyleSmall:
      return GHNSColorFromRGB(0xCCCCCC);

    case KBButtonStylePrimary:
      return nil;

    case KBButtonStyleLink:
    case KBButtonStyleText:
    case KBButtonStyleCheckbox:
    case KBButtonStyleEmpty:
      return nil;
  }
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
  return [NSColor colorWithWhite:0.05 alpha:1.0];
}

@end