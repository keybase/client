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

#import <YOLayout/YOLayout+PrefabLayouts.h>

@interface KBPGPVerifyAppView ()
@property KBPGPVerifyView *verifyView;
@property KBPGPOutputView *outputView;
@end

@implementation KBPGPVerifyAppView

- (void)viewInit {
  [super viewInit];

  GHWeakSelf gself = self;
  _verifyView = [[KBPGPVerifyView alloc] init];
  _verifyView.onVerify = ^(KBPGPVerifyView *view, KBPGPDecrypted *decrypted) {
    KBRPGPSigVerification *pgpSigVerification = decrypted.pgpSigVerification;
    if (pgpSigVerification) {
      NSString *text = [[NSString alloc] initWithData:decrypted.stream.writer.data encoding:NSUTF8StringEncoding];
      [gself.outputView setText:text wrap:YES];
      [gself.outputView setPgpSigVerification:pgpSigVerification];
      [gself.navigation pushView:gself.outputView animated:YES];
    } else {
      DDLogDebug(@"Clearing");
      [gself.outputView clear];
    }
  };
  [self addSubview:_verifyView];

  _outputView = [[KBPGPOutputView alloc] init];
  _outputView.footerView.closeButton.hidden = YES;

  self.viewLayout = [YOLayout fill:_verifyView];
}

- (void)setClient:(KBRPClient *)client {
  _client = client;
  _verifyView.client = client;
}

@end
