//
//  KBView.m
//  Keybase
//
//  Created by Gabriel on 12/23/14.
//  Copyright (c) 2014 Gabriel Handford. All rights reserved.
//

#import "KBView.h"

@interface KBView ()

@end

@implementation KBView

- (void)drawRect:(NSRect)rect {
  [NSColor.whiteColor setFill];
  NSRectFill(rect);
  [super drawRect:rect];
}

@end
