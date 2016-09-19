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

#import <YOLayout/YOLayout+PrefabLayouts.h>

@interface KBPGPEncryptAppView ()
@property KBPGPEncryptView *encryptView;
@property KBPGPOutputView *outputView;
@end

@implementation KBPGPEncryptAppView

- (void)viewInit {
  [super viewInit];

  GHWeakSelf gself = self;
  _encryptView = [[KBPGPEncryptView alloc] init];
  [KBActivity setProgressEnabled:YES sender:self];
  _encryptView.onEncrypt = ^(KBPGPEncryptView *view, NSData *data) {
    if (data) {
      [KBActivity setProgressEnabled:NO sender:gself];
      [gself.outputView setData:data armored:YES];
      [gself.navigation pushView:gself.outputView animated:YES];
    } else {
      [gself.outputView clear];
    }
  };
  [self addSubview:_encryptView];

  _outputView = [[KBPGPOutputView alloc] init];
  _outputView.footerView.closeButton.hidden = YES;

  self.viewLayout = [YOLayout fill:_encryptView];
}

- (void)setClient:(KBRPClient *)client {
  _client = client;
  _encryptView.client = client;
}

@end
