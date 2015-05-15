//
//  KBAppearance.h
//  KBAppKit
//
//  Created by Gabriel on 2/20/15.
//  Copyright (c) 2015 KBAppKit. All rights reserved.
//

#import <Foundation/Foundation.h>
#import <AppKit/AppKit.h>

typedef NS_ENUM (NSInteger, KBTextStyle) {
  KBTextStyleNone,
  KBTextStyleDefault,
  KBTextStyleSecondaryText,
  KBTextStyleHeader,
  KBTextStyleHeaderLarge,
};

typedef NS_OPTIONS (NSInteger, KBTextOptions) {
  KBTextOptionsStrong,
  KBTextOptionsMonospace,
  KBTextOptionsSmall,
};

typedef NS_ENUM (NSInteger, KBButtonStyle) {
  KBButtonStyleDefault,
  KBButtonStylePrimary,
  KBButtonStyleDanger,
  KBButtonStyleLink,
  KBButtonStyleCheckbox,
  KBButtonStyleText,
  KBButtonStyleEmpty,
  KBButtonStyleToolbar,
};

@protocol KBAppearance

- (NSColor *)textColor;
- (NSColor *)secondaryTextColor;
- (NSColor *)selectColor;
- (NSColor *)disabledTextColor;
- (NSColor *)selectedTextColor;

- (NSColor *)okColor;
- (NSColor *)warnColor;
- (NSColor *)errorColor;

- (NSColor *)greenColor;

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

- (NSColor *)colorForStyle:(KBTextStyle)style options:(KBTextOptions)options;

- (NSFont *)fontForStyle:(KBTextStyle)style options:(KBTextOptions)options;

- (NSColor *)buttonTextColorForStyle:(KBButtonStyle)style enabled:(BOOL)enabled highlighted:(BOOL)highlighted;
- (NSColor *)buttonFillColorForStyle:(KBButtonStyle)style enabled:(BOOL)enabled highlighted:(BOOL)highlighted toggled:(BOOL)toggled;
- (NSColor *)buttonStrokeColorForStyle:(KBButtonStyle)style enabled:(BOOL)enabled highlighted:(BOOL)highlighted;

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

