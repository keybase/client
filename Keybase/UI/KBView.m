//
//  KBView.m
//  Keybase
//
//  Created by Gabriel on 1/8/15.
//  Copyright (c) 2015 Gabriel Handford. All rights reserved.
//

#import "KBView.h"

#import "KBProgressOverlayView.h"
#import "KBActivityIndicatorView.h"

@interface KBView ()
@property KBProgressOverlayView *progressView;
@end

@implementation KBView

- (void)viewInit {
  [super viewInit];
  self.wantsLayer = YES;
  [self setBackgroundColor:NSColor.whiteColor];

  GHWeakSelf gself = self;
  _errorHandler = ^(NSError *error) { [gself setError:error]; };
}

- (void)setBackgroundColor:(NSColor *)backgroundColor {
  [self.layer setBackgroundColor:backgroundColor.CGColor];
}

- (void)layout {
  [super layout];
  if (_progressView) {
    _progressView.frame = self.bounds;
  }
}

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

- (void)setProgressIndicatorEnabled:(BOOL)progressIndicatorEnabled {
  if (progressIndicatorEnabled) {
    if (!_progressView) {
      _progressView = [[KBProgressOverlayView alloc] init];
      [self addSubview:_progressView];
    }
    [_progressView startAnimating];
  } else {
    [_progressView stopAnimating];
  }
}

- (void)setError:(NSError *)error {
  [self setError:error sender:nil];
}

- (void)setError:(NSError *)error sender:(NSView *)sender {
  if (error) {
    [[NSAlert alertWithError:error] beginSheetModalForWindow:self.window completionHandler:nil];
    [sender becomeFirstResponder];
  }
}

- (void)viewWillAppearInView:(NSView *)view animated:(BOOL)animated { }
- (void)viewDidAppear:(BOOL)animated { }

@end
