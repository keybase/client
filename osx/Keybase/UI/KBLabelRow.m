//
//  KBLabelRow.m
//  Keybase
//
//  Created by Gabriel on 2/5/15.
//  Copyright (c) 2015 Gabriel Handford. All rights reserved.
//

#import "KBLabelRow.h"
#import "KBAppearance.h"

@interface KBLabelRow ()
@property KBLabel *label;
@end

@implementation KBLabelRow

- (instancetype)initWithFrame:(NSRect)frameRect {
  if ((self = [super initWithFrame:frameRect])) {
    _label = [[KBLabel alloc] init];
    [self addSubview:_label];
  }
  return self;
}

- (void)layout {
  [super layout];
  _label.frame = CGRectMake(16, 0, self.frame.size.width - 16, self.frame.size.height);
}

//- (void)drawSelectionInRect:(NSRect)dirtyRect {
//  if (self.selectionHighlightStyle != NSTableViewSelectionHighlightStyleNone) {
//    [[KBAppearance.currentAppearance highlightBackgroundColor] setFill];
//    [[NSBezierPath bezierPathWithRect:self.bounds] fill];
//  }
//}

@end
