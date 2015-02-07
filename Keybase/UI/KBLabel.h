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

typedef NS_ENUM(NSUInteger, KBVerticalAlignment) {
  KBVerticalAlignmentTop,
  KBVerticalAlignmentMiddle,
  KBVerticalAlignmentBottom,
  KBVerticalAlignmentBaseline,
};

@interface KBLabel : YONSView

@property (nonatomic) NSAttributedString *attributedText;
@property (nonatomic) BOOL selectable;
@property KBVerticalAlignment verticalAlignment;

- (void)setBackgroundColor:(NSColor *)backgroundColor;

- (void)setBorderWithColor:(NSColor *)color width:(CGFloat)width;

- (void)setText:(NSString *)text font:(NSFont *)font color:(NSColor *)color alignment:(NSTextAlignment)alignment;

- (void)setMarkup:(NSString *)markup font:(NSFont *)font color:(NSColor *)color alignment:(NSTextAlignment)alignment lineBreakMode:(NSLineBreakMode)lineBreakMode;

+ (CGSize)sizeThatFits:(CGSize)size attributedString:(NSAttributedString *)attributedString;

- (BOOL)hasText;

+ (NSMutableAttributedString *)join:(NSArray *)attributedStrings delimeter:(NSAttributedString *)delimeter;

+ (NSMutableAttributedString *)parseMarkup:(NSString *)markup font:(NSFont *)font color:(NSColor *)color;

@end

