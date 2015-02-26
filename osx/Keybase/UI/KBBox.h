//
//  KBBox.h
//  Keybase
//
//  Created by Gabriel on 1/28/15.
//  Copyright (c) 2015 Gabriel Handford. All rights reserved.
//

#import <Foundation/Foundation.h>

#import <YOLayout/YOLayout.h>

@interface KBBox : YONSView

@property UIEdgeInsets insets;

+ (KBBox *)line;

+ (KBBox *)lineWithWidth:(CGFloat)width color:(NSColor *)color;

+ (KBBox *)lineWithInsets:(UIEdgeInsets)insets;

+ (KBBox *)roundedWithWidth:(CGFloat)width color:(NSColor *)color cornerRadius:(CGFloat)cornerRadius;

@end
