//
//  NSView+KBView.m
//  Keybase
//
//  Created by Gabriel on 3/5/15.
//  Copyright (c) 2015 Gabriel Handford. All rights reserved.
//

#import "NSView+KBView.h"
#import "KBAppearance.h"

@implementation NSView (KBView)

- (void)kb_setBackgroundColor:(NSColor *)backgroundColor {
  self.wantsLayer = YES;
  self.layer.backgroundColor = backgroundColor.CGColor;
}

@end
