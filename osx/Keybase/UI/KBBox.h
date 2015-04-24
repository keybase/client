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

typedef NS_ENUM(NSInteger, KBBoxPosition) {
  KBBoxPositionNone = 0,
  KBBoxPositionTop,
  KBBoxPositionBottom,
  KBBoxPositionLeft,
  KBBoxPositionRight
};

@interface KBBox : YOView

@property UIEdgeInsets insets;
@property KBBoxType type;
@property KBBoxPosition position;

+ (instancetype)horizontalLine;
+ (instancetype)line;

+ (instancetype)lineWithWidth:(CGFloat)width color:(NSColor *)color type:(KBBoxType)type;

+ (instancetype)lineWithInsets:(UIEdgeInsets)insets;

+ (instancetype)roundedWithWidth:(CGFloat)width color:(NSColor *)color cornerRadius:(CGFloat)cornerRadius;

+ (instancetype)spacing:(CGFloat)spacing;

- (CGRect)layoutForPositionWithLayout:(id<YOLayout>)layout size:(CGSize)size;

@end
