//
//  KBConnectView.m
//  Keybase
//
//  Created by Gabriel on 3/5/15.
//  Copyright (c) 2015 Gabriel Handford. All rights reserved.
//

#import "KBConnectView.h"

@interface KBConnectView ()
@end

@implementation KBConnectView

- (void)viewInit {
  [super viewInit];
  //GHWeakSelf gself = self;
  self.backgroundColor = KBAppearance.currentAppearance.secondaryBackgroundColor;

  _progressView = [[KBProgressOverlayView alloc] init];
  [self addSubview:_progressView];

  self.viewLayout = [YOLayout fill:_progressView];
}

- (void)viewDidAppear:(BOOL)animated { }

@end
