//
//  KBFontAwesome.h
//  Keybase
//
//  Created by Gabriel on 6/18/15.
//  Copyright (c) 2015 Keybase. All rights reserved.
//

#import <Foundation/Foundation.h>
#import <AppKit/AppKit.h>

#import "KBAppearance.h"
#import "KBButton.h"

@interface KBFontAwesome : NSObject

+ (NSFont *)fontWithSize:(CGFloat)size;

+ (NSString *)codeForIcon:(NSString *)icon;

+ (NSAttributedString *)attributedStringForIcon:(NSString *)icon style:(KBTextStyle)style options:(KBTextOptions)options alignment:(NSTextAlignment)alignment lineBreakMode:(NSLineBreakMode)lineBreakMode;

+ (NSAttributedString *)attributedStringForIcon:(NSString *)icon appearance:(id<KBAppearance>)appearance style:(KBTextStyle)style options:(KBTextOptions)options alignment:(NSTextAlignment)alignment lineBreakMode:(NSLineBreakMode)lineBreakMode;

+ (NSAttributedString *)attributedStringForIcon:(NSString *)icon color:(NSColor *)color size:(CGFloat)size alignment:(NSTextAlignment)alignment lineBreakMode:(NSLineBreakMode)lineBreakMode;

+ (NSAttributedString *)attributedStringForIcon:(NSString *)icon text:(NSString *)text style:(KBTextStyle)style options:(KBTextOptions)options alignment:(NSTextAlignment)alignment lineBreakMode:(NSLineBreakMode)lineBreakMode;

+ (NSAttributedString *)attributedStringForIcon:(NSString *)icon text:(NSString *)text appearance:(id<KBAppearance>)appearance style:(KBTextStyle)style options:(KBTextOptions)options alignment:(NSTextAlignment)alignment lineBreakMode:(NSLineBreakMode)lineBreakMode;

+ (KBButton *)buttonForIcon:(NSString *)icon text:(NSString *)text style:(KBButtonStyle)style options:(KBButtonOptions)options;

@end
