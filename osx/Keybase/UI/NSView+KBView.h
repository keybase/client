//
//  NSView+KBView.h
//  Keybase
//
//  Created by Gabriel on 3/2/15.
//  Copyright (c) 2015 Gabriel Handford. All rights reserved.
//

#import <Foundation/Foundation.h>

#import <AppKit/AppKit.h>

@interface NSView (KBView)

- (void)kb_setBackgroundColor:(NSColor *)backgroundColor;

- (void)kb_setBorderWithColor:(NSColor *)color width:(CGFloat)width;

@end