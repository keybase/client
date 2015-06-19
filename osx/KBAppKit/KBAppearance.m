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

- (NSColor *)textColorForStyle:(KBTextStyle)style options:(KBTextOptions)options {
  if (options & KBTextOptionsDanger) return KBColorWithStyle(self.dangerColor, NSBackgroundStyleDark);
  if (options & KBTextOptionsWarning) return KBColorWithStyle(self.warnColor, NSBackgroundStyleDark);
  if (options & KBTextOptionsSelect) return KBColorWithStyle(self.selectColor, NSBackgroundStyleLight);

  switch (style) {
    case KBTextStyleDefault:
    case KBTextStyleHeader:
    case KBTextStyleHeaderLarge:
      return KBColorWithStyle(self.textColor, NSBackgroundStyleLight);

    case KBTextStyleSecondaryText:
      return KBColorWithStyle(self.secondaryTextColor, NSBackgroundStyleLight);
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
  return KBColorFromRGBA(0x333333, 1.0, NSBackgroundStyleLight);
}

- (NSColor *)secondaryTextColor {
  return KBColorFromRGBA(0x666666, 1.0, NSBackgroundStyleLight);
}

- (NSColor *)selectColor {
  //return [NSColor colorWithRed:87.0/255.0 green:153.0/255.0 blue:220.0/255.0 alpha:1.0f];
  //return [NSColor colorWithRed:0.0f green:0.49f blue:0.96f alpha:1.0f];
  //return KBColorFromRGBA(0x286090);
  //return [NSColor colorWithRed:9.0/255.0 green:80.0/255.0 blue:208.0/255.0 alpha:1.0f];
  //return [NSColor colorWithRed:50.0/255.0 green:132.0/255.0 blue:252.0/255.0 alpha:1.0f];
  return KBColorFromRGBA(0x0084FF, 1.0, NSBackgroundStyleLight);
}

- (NSColor *)disabledTextColor {
  return KBColorFromRGBA(0x999999, 1.0, NSBackgroundStyleLight);
}

- (NSColor *)selectedTextColor {
  return NSColor.whiteColor;
}

- (NSColor *)primaryButtonColor {
  return self.selectColor;
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

- (NSColor *)dangerButtonColor {
  return [NSColor colorWithRed:208.0/255.0 green:59.0/255.0 blue:59.0/255.0 alpha:1.0];
}

- (NSColor *)warnButtonColor {
  return [NSColor colorWithRed:232.0/255.0 green:134.0/255.0 blue:0/255.0 alpha:1.0f];
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
  return [NSFont fontWithName:@"Helvetica Neue Thin" size:BASE_FONT_SIZE+18];
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

- (NSMutableAttributedString *)attributedString:(NSString *)string style:(KBTextStyle)style options:(KBTextOptions)options alignment:(NSTextAlignment)alignment lineBreakMode:(NSLineBreakMode)lineBreakMode {
  NSColor *color = [self textColorForStyle:style options:options];
  NSFont *font = [self fontForStyle:style options:options];

  NSMutableParagraphStyle *paragraphStyle = [[NSMutableParagraphStyle alloc] init];
  paragraphStyle.alignment = alignment;
  paragraphStyle.lineBreakMode = lineBreakMode;

  NSDictionary *attributes = @{NSForegroundColorAttributeName: color, NSFontAttributeName: font, NSParagraphStyleAttributeName:paragraphStyle};
  return [[NSMutableAttributedString alloc] initWithString:string attributes:attributes];
}

- (NSColor *)buttonTextColorForStyle:(KBButtonStyle)style options:(KBButtonOptions)options enabled:(BOOL)enabled highlighted:(BOOL)highlighted {
  if (!enabled) return KBColorFromRGBA(0x666666, 1.0, NSBackgroundStyleLight);
  switch (style) {
    case KBButtonStyleDefault:
      return KBColorFromRGBA(0x333333, 1.0, NSBackgroundStyleLight);

    case KBButtonStylePrimary:
    case KBButtonStyleDanger:
    case KBButtonStyleWarning:
      return KBColorFromRGBA(0xFFFFFF, 1.0, NSBackgroundStyleLight);

    case KBButtonStyleLink:
      return highlighted ? KBColorFromRGBA(0x000000, 1.0, NSBackgroundStyleLight) : [KBAppearance.currentAppearance selectColor];

    case KBButtonStyleText:
      NSAssert(NO, @"Text style shouldn't get here");

    case KBButtonStyleCheckbox:
      return KBColorFromRGBA(0x333333, 1.0, NSBackgroundStyleLight);

    case KBButtonStyleEmpty:
      return nil;
  }
}

- (NSColor *)buttonDisabledFillColorForStyle:(KBButtonStyle)style options:(KBButtonOptions)options {
  switch (style) {
    case KBButtonStyleDefault:
    case KBButtonStylePrimary:
    case KBButtonStyleDanger:
    case KBButtonStyleWarning:
      return KBColorFromRGBA(0xEFEFEF, 1.0, NSBackgroundStyleLight);

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
      return KBColorFromRGBA(0xDEDEDE, 1.0, NSBackgroundStyleLight);

    case KBButtonStylePrimary:
      return [NSColor colorWithRed:192.0/255.0 green:221.0/255.0 blue:250.0/255.0 alpha:1.0];

    case KBButtonStyleDanger:
      return [NSColor colorWithRed:189.0/255.0 green:26.0/255.0 blue:29.0/255.0 alpha:1.0];

    case KBButtonStyleWarning:
      return [self warnButtonColor];

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
      return [self primaryButtonColor];

    case KBButtonStyleDanger:
      return [self dangerButtonColor];

    case KBButtonStyleWarning:
      return [self warnButtonColor];

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
    case KBButtonStyleWarning:
      return KBColorFromRGBA(0xCCCCCC, 1.0, NSBackgroundStyleLight);

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
      return KBColorFromRGBA(0xCCCCCC, 1.0, NSBackgroundStyleLight);

    case KBButtonStylePrimary:
    case KBButtonStyleDanger:
    case KBButtonStyleWarning:
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
  return KBColorFromRGBA(0xFFFFFF, 1.0, NSBackgroundStyleLight);
}

- (NSColor *)secondaryTextColor {
  return KBColorFromRGBA(0xEEEEEE, 1.0, NSBackgroundStyleLight);
}

- (NSColor *)disabledTextColor {
  return KBColorFromRGBA(0x666666, 1.0, NSBackgroundStyleLight);
}

- (NSColor *)backgroundColor {
  return NSColor.blackColor;
}

- (NSColor *)secondaryBackgroundColor {
  return [NSColor colorWithWhite:0.05 alpha:1.0];
}

@end
