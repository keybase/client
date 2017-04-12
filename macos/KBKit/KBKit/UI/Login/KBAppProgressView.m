//
//  KBAppProgressView.m
//  Keybase
//
//  Created by Gabriel on 3/5/15.
//  Copyright (c) 2015 Gabriel Handford. All rights reserved.
//

#import "KBAppProgressView.h"

#import <YOLayout/YOLayout+PrefabLayouts.h>

@interface KBAppProgressView ()
@property KBProgressOverlayView *progressView;
@end

@implementation KBAppProgressView

- (void)viewInit {
  [super viewInit];
  [self kb_setBackgroundColor:KBAppearance.currentAppearance.secondaryBackgroundColor];

  _progressView = [[KBProgressOverlayView alloc] init];
  [self addSubview:_progressView];

  self.viewLayout = [YOLayout center:_progressView];
}

- (void)viewDidAppear:(BOOL)animated { }

- (void)setProgressTitle:(NSString *)progressTitle {
  _progressView.title = progressTitle;
}

- (void)setAnimating:(BOOL)animating {
  _progressView.animating = animating;
}

- (BOOL)isAnimating {
  return _progressView.isAnimating;
}

@end
