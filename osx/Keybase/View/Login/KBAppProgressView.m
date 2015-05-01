//
//  KBAppProgressView.m
//  Keybase
//
//  Created by Gabriel on 3/5/15.
//  Copyright (c) 2015 Gabriel Handford. All rights reserved.
//

#import "KBAppProgressView.h"

@interface KBAppProgressView ()
@property KBProgressOverlayView *progressView;
@end

@implementation KBAppProgressView

- (void)viewInit {
  [super viewInit];
  [self kb_setBackgroundColor:KBAppearance.currentAppearance.secondaryBackgroundColor];

  _progressView = [[KBProgressOverlayView alloc] init];
  [self addSubview:_progressView];

  self.viewLayout = [YOLayout fill:_progressView];
}

- (void)viewDidAppear:(BOOL)animated { }

- (void)enableProgressWithTitle:(NSString *)title {
  _progressView.title = title;
  _progressView.animating = YES;
}

- (void)disableProgress {
  _progressView.animating = NO;
}

@end
