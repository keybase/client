//
//  KBColor.h
//  KBAppKit
//
//  Created by Gabriel on 6/12/15.
//  Copyright (c) 2015 KBAppKit. All rights reserved.
//

#import <Foundation/Foundation.h>
#import <AppKit/AppKit.h>

@interface NSColor (KBColor)

@property NSBackgroundStyle backgroundStyle;

@end

NSColor *KBColorWithStyle(NSColor *color, NSBackgroundStyle backgroundStyle);

// KBColorFromRGBA(0xFAFAFA, 1.0, NSBackgroundStyleDark);
NSColor *KBColorFromRGBA(uint32_t rgb, CGFloat alpha, NSBackgroundStyle backgroundStyle);
