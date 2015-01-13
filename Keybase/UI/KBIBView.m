//
//  KBIBView.m
//  Keybase
//
//  Created by Gabriel on 12/23/14.
//  Copyright (c) 2014 Gabriel Handford. All rights reserved.
//

#import "KBIBView.h"

@interface KBIBView ()

@end

@implementation KBIBView

- (void)drawRect:(NSRect)rect {
  [NSColor.whiteColor setFill];
  NSRectFill(rect);
  [super drawRect:rect];
}

@end
