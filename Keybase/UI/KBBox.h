//
//  KBBox.h
//  Keybase
//
//  Created by Gabriel on 1/28/15.
//  Copyright (c) 2015 Gabriel Handford. All rights reserved.
//

#import <Foundation/Foundation.h>

@import AppKit;

@interface KBBox : NSBox

+ (KBBox *)lineWithWidth:(CGFloat)width color:(NSColor *)color;

+ (KBBox *)roundedWithWidth:(CGFloat)width color:(NSColor *)color cornerRadius:(CGFloat)cornerRadius;

@end
