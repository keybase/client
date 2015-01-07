//
//  KBViewController.m
//  Keybase
//
//  Created by Gabriel on 1/6/15.
//  Copyright (c) 2015 Gabriel Handford. All rights reserved.
//

#import "KBViewController.h"

@implementation KBViewController

- (void)setInProgress:(BOOL)inProgress sender:(id)sender {
  for (NSView *view in self.view.subviews) {
    if ([view isKindOfClass:NSControl.class]) {
      ((NSControl *)view).enabled = !inProgress;
    }
  }
}

@end
