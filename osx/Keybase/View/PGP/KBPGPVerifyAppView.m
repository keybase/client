//
//  KBPGPVerifyAppView.m
//  Keybase
//
//  Created by Gabriel on 4/27/15.
//  Copyright (c) 2015 Gabriel Handford. All rights reserved.
//

#import "KBPGPVerifyAppView.h"

#import "KBPGPVerifyView.h"
#import "KBPGPOutputView.h"

@interface KBPGPVerifyAppView ()
@property KBPGPVerifyView *verifyView;
@property KBPGPOutputView *outputView;
@end

@implementation KBPGPVerifyAppView

- (void)viewInit {
  [super viewInit];

  KBSplitView *view = [[KBSplitView alloc] init];
  view.dividerRatio = .50;
  [self addSubview:view];

  GHWeakSelf gself = self;
  _verifyView = [[KBPGPVerifyView alloc] init];
  _verifyView.onVerify = ^(KBPGPVerifyView *view) {
  };

  _outputView = [[KBPGPOutputView alloc] init];
  _outputView.footerView.editButton.hidden = YES;
  _outputView.footerView.closeButton.hidden = YES;

  [view setLeftView:_verifyView rightView:_outputView];

  self.viewLayout = [YOLayout fill:view];
}

- (void)setClient:(KBRPClient *)client {
  [super setClient:client];
  _verifyView.client = client;
}

@end