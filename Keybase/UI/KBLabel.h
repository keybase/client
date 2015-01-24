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

@interface KBLabel : YONSView

@property (nonatomic) NSAttributedString *attributedText;

- (void)setText:(NSString *)text font:(NSFont *)font color:(NSColor *)color alignment:(NSTextAlignment)alignment;

+ (CGSize)sizeThatFits:(CGSize)size attributedString:(NSAttributedString *)attributedString;

- (BOOL)hasText;

+ (NSMutableAttributedString *)join:(NSArray *)attributedStrings delimeter:(NSAttributedString *)delimeter;

@end

