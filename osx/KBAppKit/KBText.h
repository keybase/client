//
//  KBText.h
//  Keybase
//
//  Created by Gabriel on 3/31/15.
//  Copyright (c) 2015 Gabriel Handford. All rights reserved.
//

#import <Foundation/Foundation.h>

#import "KBAppKitDefines.h"
#import "KBAppearance.h"

@interface KBText : NSObject

+ (CGSize)sizeThatFits:(CGSize)size textView:(NSTextView *)textView;
+ (CGSize)sizeThatFits:(CGSize)size attributedString:(NSAttributedString *)attributedString;
+ (NSMutableAttributedString *)join:(NSArray *)attributedStrings delimeter:(NSAttributedString *)delimeter;

+ (NSAttributedString *)parseMarkup:(NSString *)markup options:(NSDictionary *)options;
+ (NSAttributedString *)parseMarkup:(NSString *)markup font:(NSFont *)font color:(NSColor *)color alignment:(NSTextAlignment)alignment lineBreakMode:(NSLineBreakMode)lineBreakMode;

+ (NSAttributedString *)attributedStringForText:(NSString *)text style:(KBTextStyle)style options:(KBTextOptions)options alignment:(NSTextAlignment)alignment lineBreakMode:(NSLineBreakMode)lineBreakMode;

+ (NSAttributedString *)attributedStringForText:(NSString *)text font:(NSFont *)font color:(NSColor *)color alignment:(NSTextAlignment)alignment lineBreakMode:(NSLineBreakMode)lineBreakMode;

@end
