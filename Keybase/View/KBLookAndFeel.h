//
//  KBLookAndFeel.h
//  Keybase
//
//  Created by Gabriel on 1/8/15.
//  Copyright (c) 2015 Gabriel Handford. All rights reserved.
//

#import <Foundation/Foundation.h>
#import <AppKit/AppKit.h>

@interface KBLookAndFeel : NSObject

+ (NSColor *)textColor;
+ (NSColor *)secondaryTextColor;
+ (NSColor *)selectColor;
+ (NSColor *)disabledTextColor;

+ (NSColor *)okColor;
+ (NSColor *)warnColor;
+ (NSColor *)errorColor;

+ (NSColor *)greenColor;

+ (NSColor *)lineColor;

+ (NSFont *)textFont;
+ (NSFont *)boldTextFont;
+ (NSFont *)buttonFont;

@end
