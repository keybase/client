//
//  KBLabel.h
//  Keybase
//
//  Created by Gabriel on 1/9/15.
//  Copyright (c) 2015 Gabriel Handford. All rights reserved.
//

#import <Foundation/Foundation.h>
#import <AppKit/AppKit.h>

#import <YOLayout/YOLayout.h>
#import "KBAppearance.h"

typedef NS_ENUM(NSInteger, KBVerticalAlignment) {
  KBVerticalAlignmentTop,
  KBVerticalAlignmentMiddle,
  KBVerticalAlignmentBottom,
  KBVerticalAlignmentBaseline,
};

typedef NS_ENUM(NSInteger, KBLabelStyle) {
  KBLabelStyleDefault,
  KBLabelStyleSecondaryText,
  KBLabelStyleHeader,
};;

@interface KBLabel : YONSView

@property (nonatomic) NSAttributedString *attributedText;
@property (nonatomic) BOOL selectable;
@property KBVerticalAlignment verticalAlignment;

+ (instancetype)labelWithText:(NSString *)text style:(KBLabelStyle)style;

- (void)setBackgroundColor:(NSColor *)backgroundColor;

- (void)setBorderWithColor:(NSColor *)color width:(CGFloat)width;

- (void)setText:(NSString *)text style:(KBLabelStyle)style;
- (void)setText:(NSString *)text style:(KBLabelStyle)style appearance:(id<KBAppearance>)appearance;
- (void)setText:(NSString *)text style:(KBLabelStyle)style appearance:(id<KBAppearance>)appearance alignment:(NSTextAlignment)alignment lineBreakMode:(NSLineBreakMode)lineBreakMode;
- (void)setText:(NSString *)text font:(NSFont *)font color:(NSColor *)color alignment:(NSTextAlignment)alignment;
- (void)setText:(NSString *)text font:(NSFont *)font color:(NSColor *)color alignment:(NSTextAlignment)alignment lineBreakMode:(NSLineBreakMode)lineBreakMode;

- (void)setMarkup:(NSString *)markup;
- (void)setMarkup:(NSString *)markup font:(NSFont *)font color:(NSColor *)color alignment:(NSTextAlignment)alignment lineBreakMode:(NSLineBreakMode)lineBreakMode;

- (void)setAttributedText:(NSMutableAttributedString *)attributedText alignment:(NSTextAlignment)alignment lineBreakMode:(NSLineBreakMode)lineBreakMode;

- (void)setColor:(NSColor *)color font:(NSFont *)font;

- (void)setStyle:(KBLabelStyle)style appearance:(id<KBAppearance>)appearance;

+ (CGSize)sizeThatFits:(CGSize)size attributedString:(NSAttributedString *)attributedString;

- (BOOL)hasText;

+ (NSMutableAttributedString *)join:(NSArray *)attributedStrings delimeter:(NSAttributedString *)delimeter;

+ (NSMutableAttributedString *)parseMarkup:(NSString *)markup font:(NSFont *)font color:(NSColor *)color;

+ (NSMutableAttributedString *)parseMarkup:(NSString *)markup font:(NSFont *)font color:(NSColor *)color alignment:(NSTextAlignment)alignment lineBreakMode:(NSLineBreakMode)lineBreakMode;

@end

