//
//  KBTextView.h
//  Keybase
//
//  Created by Gabriel on 2/12/15.
//  Copyright (c) 2015 Gabriel Handford. All rights reserved.
//

#import <Foundation/Foundation.h>

#import <YOLayout/YOLayout.h>
#import "KBAppearance.h"

@interface KBTextView : NSScrollView <NSTextViewDelegate>

@property (readonly) NSTextView *view;
@property (nonatomic) NSAttributedString *attributedText;
@property (nonatomic) NSString *text;

- (void)setText:(NSString *)text font:(NSFont *)font color:(NSColor *)color;
- (void)setText:(NSString *)text font:(NSFont *)font color:(NSColor *)color alignment:(NSTextAlignment)alignment lineBreakMode:(NSLineBreakMode)lineBreakMode;

- (void)setText:(NSString *)text style:(KBTextStyle)style;
- (void)setText:(NSString *)text style:(KBTextStyle)style alignment:(NSTextAlignment)alignment lineBreakMode:(NSLineBreakMode)lineBreakMode;

@end
