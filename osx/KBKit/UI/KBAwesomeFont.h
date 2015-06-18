//
//  KBAwesomeFont.h
//  Keybase
//
//  Created by Gabriel on 6/18/15.
//  Copyright (c) 2015 Keybase. All rights reserved.
//

#import <Foundation/Foundation.h>
#import <AppKit/AppKit.h>

#import "KBAppearance.h"

@interface KBAwesomeFont : NSObject

+ (NSFont *)fontWithSize:(CGFloat)size;

+ (NSString *)codeForIcon:(NSString *)icon;

+ (NSAttributedString *)attributedStringForIcon:(NSString *)icon appearance:(id<KBAppearance>)appearance style:(KBTextStyle)style options:(KBTextOptions)options;

+ (NSAttributedString *)attributedStringForIcon:(NSString *)icon color:(NSColor *)color size:(CGFloat)size;

@end
