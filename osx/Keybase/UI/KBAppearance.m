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

- (NSColor *)colorForStyle:(KBTextStyle)style options:(KBTextOptions)options {
  if (options & KBTextOptionsDanger) {
    return self.dangerColor;
  }

  switch (style) {
    case KBTextStyleDefault:
    case KBTextStyleHeader:
    case KBTextStyleHeaderLarge:
      return self.textColor;

    case KBTextStyleSecondaryText:
      return self.secondaryTextColor;
  }
}

- (NSFont *)fontForStyle:(KBTextStyle)style options:(KBTextOptions)options {
  NSFont *font = self.textFont;
  switch (style) {
    case KBTextStyleHeader:
      font = self.headerTextFont;
      break;

    case KBTextStyleHeaderLarge:
      font = self.headerLargeTextFont;
      break;

    default:
      break;
  }

  // TODO These options overwrite each other
  if (options & KBTextOptionsMonospace) {
    font = [NSFont fontWithName:@"Monaco" size:font.pointSize-2];
  }
  if (options & KBTextOptionsStrong) {
    font = [NSFont boldSystemFontOfSize:font.pointSize];
  }
  if (options & KBTextOptionsSmall) {
    font = [NSFont fontWithDescriptor:font.fontDescriptor size:font.pointSize-1];
  }

  return font;
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

- (NSColor *)successColor {
  return [NSColor colorWithRed:9.0/255.0 green:179.0/255.0 blue:18.0/255.0 alpha:1.0f];
}

- (NSColor *)successBackgroundColor {
  return [NSColor colorWithRed:230.0/255.0 green:1.0 blue:190.0/255.0 alpha:1.0];
}

- (NSColor *)warnColor {
  return [NSColor colorWithRed:1.0f green:0.58f blue:0.19f alpha:1.0f];
}

- (NSColor *)warnBackgroundColor {
  return [NSColor colorWithRed:251.0/255.0 green:247.0/255.0 blue:219.0/255.0 alpha:1.0f];
}

- (NSColor *)dangerColor {
  return [NSColor colorWithRed:1.0f green:0.22f blue:0.22f alpha:1.0f];
}

- (NSColor *)dangerBackgroundColor {
  return [NSColor colorWithRed:247.0/255.0 green:238.0/255.0 blue:241.0/255.0 alpha:1.0f];
}

- (NSColor *)infoBackgroundColor {
  return [NSColor colorWithRed:208.0/255.0 green:232.0/255.0 blue:246.0/255.0 alpha:1.0f];
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

- (NSColor *)buttonTextColorForStyle:(KBButtonStyle)style options:(KBButtonOptions)options enabled:(BOOL)enabled highlighted:(BOOL)highlighted {
  if (!enabled) return GHNSColorFromRGB(0x666666);
  switch (style) {
    case KBButtonStyleDefault:
      return GHNSColorFromRGB(0x333333);

    case KBButtonStylePrimary:
    case KBButtonStyleDanger:
      return GHNSColorFromRGB(0xFFFFFF);

    case KBButtonStyleLink:
      return highlighted ? GHNSColorFromRGB(0x000000) : [KBAppearance.currentAppearance selectColor];

    case KBButtonStyleText:
      NSAssert(NO, @"Text style shouldn't get here");

    case KBButtonStyleCheckbox:
      return GHNSColorFromRGB(0x333333);

    case KBButtonStyleEmpty:
      return nil;
  }
}

- (NSColor *)buttonDisabledFillColorForStyle:(KBButtonStyle)style options:(KBButtonOptions)options {
  switch (style) {
    case KBButtonStyleDefault:
    case KBButtonStylePrimary:
    case KBButtonStyleDanger:
      return GHNSColorFromRGB(0xEFEFEF);

    case KBButtonStyleLink:
    case KBButtonStyleText:
    case KBButtonStyleCheckbox:
    case KBButtonStyleEmpty:
      return nil;
  }
}

- (NSColor *)buttonHighlightedFillColorForStyle:(KBButtonStyle)style options:(KBButtonOptions)options {
  switch (style) {
    case KBButtonStyleEmpty:
    case KBButtonStyleDefault:
    case KBButtonStyleText:
      return GHNSColorFromRGB(0xDEDEDE);

    case KBButtonStylePrimary:
      return [NSColor colorWithRed:192.0/255.0 green:221.0/255.0 blue:250.0/255.0 alpha:1.0];

    case KBButtonStyleDanger:
      return [NSColor colorWithRed:189.0/255.0 green:26.0/255.0 blue:29.0/255.0 alpha:1.0];

    case KBButtonStyleCheckbox:
    case KBButtonStyleLink:
      return nil;
  }
}

- (NSColor *)buttonFillColorForStyle:(KBButtonStyle)style options:(KBButtonOptions)options enabled:(BOOL)enabled highlighted:(BOOL)highlighted toggled:(BOOL)toggled {
  if (toggled) return [self buttonHighlightedFillColorForStyle:style options:options];
  if (!enabled) return [self buttonDisabledFillColorForStyle:style options:options];
  if (highlighted) return [self buttonHighlightedFillColorForStyle:style options:options];
  switch (style) {
    case KBButtonStyleDefault:
      return [NSColor colorWithWhite:0.99 alpha:1.0];

    case KBButtonStylePrimary:
      return KBAppearance.currentAppearance.selectColor;

    case KBButtonStyleDanger:
      return [NSColor colorWithRed:208.0/255.0 green:59.0/255.0 blue:59.0/255.0 alpha:1.0];

    case KBButtonStyleEmpty:
    case KBButtonStyleLink:
    case KBButtonStyleText:
    case KBButtonStyleCheckbox:
      return nil;
  }
}

- (NSColor *)buttonDisabledStrokeColorForStyle:(KBButtonStyle)style options:(KBButtonOptions)options {
  switch (style) {
    case KBButtonStyleDefault:
    case KBButtonStylePrimary:
    case KBButtonStyleDanger:
      return GHNSColorFromRGB(0xCCCCCC);

    case KBButtonStyleLink:
    case KBButtonStyleText:
    case KBButtonStyleCheckbox:
    case KBButtonStyleEmpty:
      return nil;
  }
}

- (NSColor *)buttonStrokeColorForStyle:(KBButtonStyle)style options:(KBButtonOptions)options enabled:(BOOL)enabled highlighted:(BOOL)highlighted {
  if (!enabled) return [self buttonDisabledStrokeColorForStyle:style options:options];
  switch (style) {
    case KBButtonStyleDefault:
      return GHNSColorFromRGB(0xCCCCCC);

    case KBButtonStylePrimary:
    case KBButtonStyleDanger:
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