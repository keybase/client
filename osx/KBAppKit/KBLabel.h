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
#import "KBBorder.h"
#import "KBAppKitDefines.h"

@interface KBLabel : YOView

@property (nonatomic) NSAttributedString *attributedText;
@property (nonatomic) BOOL selectable;
@property KBVerticalAlignment verticalAlignment;
//@property KBHorizontalAlignment horizontalAlignment;
@property KBBorder *border;
@property UIEdgeInsets insets;
@property (readonly) NSTextView *textView;

@property CGFloat fixedHeight; // For table view cells

+ (instancetype)label;
+ (instancetype)labelWithText:(NSString *)text style:(KBTextStyle)style;
+ (instancetype)labelWithText:(NSString *)text style:(KBTextStyle)style alignment:(NSTextAlignment)alignment lineBreakMode:(NSLineBreakMode)lineBreakMode;
+ (instancetype)labelWithText:(NSString *)text style:(KBTextStyle)style options:(KBTextOptions)options alignment:(NSTextAlignment)alignment lineBreakMode:(NSLineBreakMode)lineBreakMode;
+ (instancetype)labelWithText:(NSString *)text style:(KBTextStyle)style verticalAlignment:(KBVerticalAlignment)verticalAlignment;

- (void)setText:(NSString *)text style:(KBTextStyle)style;
- (void)setText:(NSString *)text style:(KBTextStyle)style alignment:(NSTextAlignment)alignment lineBreakMode:(NSLineBreakMode)lineBreakMode;
- (void)setText:(NSString *)text style:(KBTextStyle)style options:(KBTextOptions)options alignment:(NSTextAlignment)alignment lineBreakMode:(NSLineBreakMode)lineBreakMode;

- (void)setText:(NSString *)text font:(NSFont *)font color:(NSColor *)color alignment:(NSTextAlignment)alignment lineBreakMode:(NSLineBreakMode)lineBreakMode;

- (void)setMarkup:(NSString *)markup;
- (void)setMarkup:(NSString *)markup style:(KBTextStyle)style alignment:(NSTextAlignment)alignment lineBreakMode:(NSLineBreakMode)lineBreakMode;
- (void)setMarkup:(NSString *)markup font:(NSFont *)font color:(NSColor *)color alignment:(NSTextAlignment)alignment lineBreakMode:(NSLineBreakMode)lineBreakMode;
- (void)setMarkup:(NSString *)markup options:(NSDictionary *)options;

- (void)setAttributedText:(NSMutableAttributedString *)attributedText alignment:(NSTextAlignment)alignment lineBreakMode:(NSLineBreakMode)lineBreakMode;
- (void)setAttributedText:(NSAttributedString *)attributedText needsLayout:(BOOL)needsLayout;

- (void)setBorderWithColor:(NSColor *)color width:(CGFloat)width;

- (void)setBorderEnabled:(BOOL)borderEnabled;

- (void)setColor:(NSColor *)color;

- (BOOL)hasText;

@end


@interface KBLabelCell : KBLabel

@end