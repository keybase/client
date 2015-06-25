//
//  KBFontIcon.h
//  Keybase
//
//  Created by Gabriel on 6/18/15.
//  Copyright (c) 2015 Keybase. All rights reserved.
//

#import <Foundation/Foundation.h>
#import <AppKit/AppKit.h>

#import "KBAppearance.h"
#import "KBButton.h"

typedef NS_ENUM (NSInteger, KBFontIconType) {
  KBFontIconTypeFontAwesome,
  //KBFontIconTypeBlackTieLight,
  KBFontIconTypeBlackTieRegular,
};

@interface KBFontIcon : NSObject

+ (NSFont *)fontWithSize:(CGFloat)size type:(KBFontIconType)type;

+ (NSAttributedString *)attributedStringForIcon:(NSString *)icon style:(KBTextStyle)style options:(KBTextOptions)options alignment:(NSTextAlignment)alignment lineBreakMode:(NSLineBreakMode)lineBreakMode sender:(id)sender;

+ (NSAttributedString *)attributedStringForIcon:(NSString *)icon appearance:(id<KBAppearance>)appearance style:(KBTextStyle)style options:(KBTextOptions)options alignment:(NSTextAlignment)alignment lineBreakMode:(NSLineBreakMode)lineBreakMode sender:(id)sender;

+ (NSAttributedString *)attributedStringForIcon:(NSString *)icon color:(NSColor *)color size:(CGFloat)size alignment:(NSTextAlignment)alignment lineBreakMode:(NSLineBreakMode)lineBreakMode sender:(id)sender;

+ (NSAttributedString *)attributedStringForIcon:(NSString *)icon text:(NSString *)text style:(KBTextStyle)style options:(KBTextOptions)options alignment:(NSTextAlignment)alignment lineBreakMode:(NSLineBreakMode)lineBreakMode sender:(id)sender;

+ (NSAttributedString *)attributedStringForIcon:(NSString *)icon text:(NSString *)text appearance:(id<KBAppearance>)appearance style:(KBTextStyle)style options:(KBTextOptions)options alignment:(NSTextAlignment)alignment lineBreakMode:(NSLineBreakMode)lineBreakMode sender:(id)sender;

+ (KBButton *)buttonForIcon:(NSString *)icon text:(NSString *)text style:(KBButtonStyle)style options:(KBButtonOptions)options sender:(id)sender;

@end
