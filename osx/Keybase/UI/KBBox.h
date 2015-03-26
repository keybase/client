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
};


@interface KBBox : YOView

@property UIEdgeInsets insets;
@property KBBoxType type;

+ (KBBox *)horizontalLine;
+ (KBBox *)line;

+ (KBBox *)lineWithWidth:(CGFloat)width color:(NSColor *)color type:(KBBoxType)type;

+ (KBBox *)lineWithInsets:(UIEdgeInsets)insets;

+ (KBBox *)roundedWithWidth:(CGFloat)width color:(NSColor *)color cornerRadius:(CGFloat)cornerRadius;

@end
