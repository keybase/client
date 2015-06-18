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

//  KBSplitView *view = [[KBSplitView alloc] init];
//  view.dividerRatio = .50;
//  [self addSubview:view];

  GHWeakSelf gself = self;
  _verifyView = [[KBPGPVerifyView alloc] init];
  _verifyView.onVerify = ^(KBPGPVerifyView *view, KBPGPDecrypted *decrypted) {
    KBRPgpSigVerification *pgpSigVerification = decrypted.pgpSigVerification;
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

//  [view setLeftView:_verifyView];
//  [view setRightView:_outputView];
//
//  self.viewLayout = [YOLayout fill:view];
  self.viewLayout = [YOLayout fill:_verifyView];
}

- (void)setClient:(KBRPClient *)client {
  [super setClient:client];
  _verifyView.client = client;
}

@end