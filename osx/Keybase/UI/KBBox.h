//
//  KBBox.h
//  Keybase
//
//  Created by Gabriel on 1/28/15.
//  Copyright (c) 2015 Gabriel Handford. All rights reserved.
//

#import <Foundation/Foundation.h>

#import <YOLayout/YOLayout.h>

typedef NS_ENUM(NSInteger, KBBoxType) {
  KBBoxTypeDefault,
  KBBoxTypeHorizontalLine,
  KBBoxTypeVerticalLine,
  KBBoxTypeSpacing,
};


@interface KBBox : YOView

@property UIEdgeInsets insets;
@property KBBoxType type;

+ (instancetype)horizontalLine;
+ (instancetype)line;

+ (instancetype)lineWithWidth:(CGFloat)width color:(NSColor *)color type:(KBBoxType)type;

+ (instancetype)lineWithInsets:(UIEdgeInsets)insets;

+ (instancetype)roundedWithWidth:(CGFloat)width color:(NSColor *)color cornerRadius:(CGFloat)cornerRadius;

+ (instancetype)spacing:(CGFloat)spacing;

@end
