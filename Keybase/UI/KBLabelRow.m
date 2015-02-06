//
//  KBLabelRow.m
//  Keybase
//
//  Created by Gabriel on 2/5/15.
//  Copyright (c) 2015 Gabriel Handford. All rights reserved.
//

#import "KBLabelRow.h"

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
  _label.frame = CGRectMake(16, 0, self.frame.size.width, self.frame.size.height);
}

@end
