//
//  KBView.m
//  Keybase
//
//  Created by Gabriel on 1/8/15.
//  Copyright (c) 2015 Gabriel Handford. All rights reserved.
//

#import "KBView.h"

@implementation KBView

- (void)setInProgress:(BOOL)inProgress sender:(NSView *)sender {
  [self _setInProgress:inProgress subviews:(sender ? sender.subviews : self.subviews)];
}

- (void)_setInProgress:(BOOL)inProgress subviews:(NSArray *)subviews {
  for (NSView *view in subviews) {
    if ([view isKindOfClass:NSControl.class]) {
      ((NSControl *)view).enabled = !inProgress;
    } else {
      [self _setInProgress:inProgress subviews:view.subviews];
    }
  }
}

- (void)setError:(NSError *)error {
  [[NSAlert alertWithError:error] beginSheetModalForWindow:self.window completionHandler:nil];
}

- (void)viewWillAppear:(BOOL)animated { }
- (void)viewDidAppear:(BOOL)animated { }
- (void)viewWillDisappear:(BOOL)animated { }
- (void)viewDidDisappear:(BOOL)animated { }

@end
