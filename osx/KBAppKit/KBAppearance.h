//
//  KBAppearance.h
//  KBAppKit
//
//  Created by Gabriel on 2/20/15.
//  Copyright (c) 2015 KBAppKit. All rights reserved.
//

#import <Foundation/Foundation.h>
#import <AppKit/AppKit.h>

#import "KBColor.h"

typedef NS_ENUM (NSInteger, KBTextStyle) {
  KBTextStyleDefault,
  KBTextStyleSecondaryText,
  KBTextStyleHeader,
  KBTextStyleHeaderLarge,
};

typedef NS_OPTIONS (NSInteger, KBTextOptions) {
  KBTextOptionsStrong = 1 << 1,
  KBTextOptionsMonospace = 1 << 2,
  KBTextOptionsSmall = 1 << 3,
  KBTextOptionsDanger = 1 << 4,
  KBTextOptionsWarning = 1 << 5,
};

typedef NS_ENUM (NSInteger, KBButtonStyle) {
  KBButtonStyleDefault,
  KBButtonStylePrimary,
  KBButtonStyleDanger,
  KBButtonStyleLink,
  KBButtonStyleCheckbox,
  KBButtonStyleText,
  KBButtonStyleEmpty,
};

typedef NS_OPTIONS (NSInteger, KBButtonOptions) {
  KBButtonOptionsToolbar = 1 << 1,
};

@protocol KBAppearance

- (NSColor *)textColor;
- (NSColor *)secondaryTextColor;
- (NSColor *)selectColor;
- (NSColor *)disabledTextColor;
- (NSColor *)selectedTextColor;

- (NSColor *)successColor;
- (NSColor *)successBackgroundColor;
- (NSColor *)warnColor;
- (NSColor *)warnBackgroundColor;
- (NSColor *)dangerColor;
- (NSColor *)dangerBackgroundColor;
- (NSColor *)infoBackgroundColor;

- (NSColor *)lineColor;
- (NSColor *)secondaryLineColor;

- (NSColor *)highlightBackgroundColor;

- (NSFont *)textFont;
- (NSFont *)smallTextFont;
- (NSFont *)boldTextFont;
- (NSFont *)boldLargeTextFont;

- (NSFont *)headerTextFont;
- (NSFont *)headerLargeTextFont;

- (NSFont *)buttonFont;

- (NSColor *)backgroundColor;
- (NSColor *)secondaryBackgroundColor;

- (NSColor *)tableGridColor;

- (NSColor *)textColorForStyle:(KBTextStyle)style options:(KBTextOptions)options;

- (NSFont *)fontForStyle:(KBTextStyle)style options:(KBTextOptions)options;

- (NSColor *)buttonTextColorForStyle:(KBButtonStyle)style options:(KBButtonOptions)options enabled:(BOOL)enabled highlighted:(BOOL)highlighted;
- (NSColor *)buttonFillColorForStyle:(KBButtonStyle)style options:(KBButtonOptions)options enabled:(BOOL)enabled highlighted:(BOOL)highlighted toggled:(BOOL)toggled;
- (NSColor *)buttonStrokeColorForStyle:(KBButtonStyle)style options:(KBButtonOptions)options enabled:(BOOL)enabled highlighted:(BOOL)highlighted;

@end

@interface KBAppearance : NSObject

+ (void)setCurrentAppearance:(id<KBAppearance>)appearance;
+ (id<KBAppearance>)currentAppearance;

+ (id<KBAppearance>)darkAppearance;
+ (id<KBAppearance>)lightAppearance;

@end

@interface KBAppearanceLight : NSObject <KBAppearance>
@end

@interface KBAppearanceDark : KBAppearanceLight <KBAppearance>
@end

