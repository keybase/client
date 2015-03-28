//
//  KBAppearance.h
//  KBAppKit
//
//  Created by Gabriel on 2/20/15.
//  Copyright (c) 2015 KBAppKit. All rights reserved.
//

#import <Foundation/Foundation.h>
#import <AppKit/AppKit.h>

typedef NS_ENUM(NSInteger, KBTextStyle) {
  KBTextStyleNone,
  KBTextStyleDefault,
  KBTextStyleSecondaryText,
  KBTextStyleMonospace,
  KBTextStyleHeader,
  KBTextStyleHeaderLarge,
};;

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

- (NSColor *)colorForStyle:(KBTextStyle)style;

- (NSFont *)fontForStyle:(KBTextStyle)style;

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

