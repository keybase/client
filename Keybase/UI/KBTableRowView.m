//
//  KBTableRowView.m
//  Keybase
//
//  Created by Gabriel on 1/19/15.
//  Copyright (c) 2015 Gabriel Handford. All rights reserved.
//

#import "KBTableRowView.h"

@implementation KBTableRowView

- (void)drawSelectionInRect:(NSRect)dirtyRect {
  if (self.selectionHighlightStyle != NSTableViewSelectionHighlightStyleNone) {
    NSRect selectionRect = NSInsetRect(self.bounds, 2.5, 2.5);
    [[NSColor colorWithCalibratedWhite:.9 alpha:1.0] setStroke];
    [[NSColor colorWithCalibratedWhite:.9 alpha:1.0] setFill];
    NSBezierPath *selectionPath = [NSBezierPath bezierPathWithRect:selectionRect]; //bezierPathWithRoundedRect:selectionRect xRadius:6 yRadius:6];
    [selectionPath fill];
    [selectionPath stroke];
  }
}

@end
