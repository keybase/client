//
//  KBTextField.m
//  Keybase
//
//  Created by Gabriel on 1/12/15.
//  Copyright (c) 2015 Gabriel Handford. All rights reserved.
//

#import "KBTextField.h"

@implementation KBTextField

- (instancetype)initWithFrame:(CGRect)frame {
  if ((self = [super initWithFrame:frame])) {
    self.bordered = NO;
    self.focusRingType = NSFocusRingTypeNone;
    self.font = [NSFont systemFontOfSize:18];
  }
  return self;
}

@end
