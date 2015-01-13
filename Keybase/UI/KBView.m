//
//  KBView.m
//  Keybase
//
//  Created by Gabriel on 1/8/15.
//  Copyright (c) 2015 Gabriel Handford. All rights reserved.
//

#import "KBView.h"

@implementation KBView

- (void)setInProgress:(BOOL)inProgress sender:(id)sender {
  for (NSView *view in self.subviews) {
    if ([view isKindOfClass:NSControl.class]) {
      ((NSControl *)view).enabled = !inProgress;
    }
  }
}

- (void)viewWillAppear:(BOOL)animated { }
- (void)viewDidAppear:(BOOL)animated { }
- (void)viewWillDisappear:(BOOL)animated { }
- (void)viewDidDisappear:(BOOL)animated { }

@end
