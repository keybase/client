//
//  KBPGPEncryptAppView.m
//  Keybase
//
//  Created by Gabriel on 4/27/15.
//  Copyright (c) 2015 Gabriel Handford. All rights reserved.
//

#import "KBPGPEncryptAppView.h"

#import "KBPGPEncryptView.h"
#import "KBPGPOutputView.h"

@interface KBPGPEncryptAppView ()
@property KBPGPEncryptView *encryptView;
@property KBPGPOutputView *outputView;
@end

@implementation KBPGPEncryptAppView

- (void)viewInit {
  [super viewInit];

  KBSplitView *encryptView = [[KBSplitView alloc] init];
  encryptView.dividerRatio = .50;
  [self addSubview:encryptView];

  GHWeakSelf gself = self;
  _encryptView = [[KBPGPEncryptView alloc] init];
  [self.navigation setProgressEnabled:YES];
  _encryptView.onEncrypt = ^(KBPGPEncryptView *view, NSData *data) {
    [gself.navigation setProgressEnabled:NO];
    [gself.outputView setASCIIData:data];
  };

  _outputView = [[KBPGPOutputView alloc] init];
  _outputView.footerView.editButton.hidden = YES;
  _outputView.footerView.closeButton.hidden = YES;

  [encryptView setLeftView:_encryptView];
  [encryptView setRightView:_outputView];

  self.viewLayout = [YOLayout fill:encryptView];
}

- (void)setClient:(KBRPClient *)client {
  [super setClient:client];
  _encryptView.client = client;
}

@end
