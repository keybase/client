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

- (void)kb_setBorderWithColor:(NSColor *)color width:(CGFloat)width {
  self.wantsLayer = YES;
  self.layer.borderColor = color.CGColor;
  self.layer.borderWidth = width;
}

- (void)kb_removeAllSubviews {
  for (NSView *subview in self.subviews) {
    [subview removeFromSuperview];
  }
}

@end
