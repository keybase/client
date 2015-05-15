//
//  KBPGPDecryptAppView.m
//  Keybase
//
//  Created by Gabriel on 4/27/15.
//  Copyright (c) 2015 Gabriel Handford. All rights reserved.
//

#import "KBPGPDecryptAppView.h"

#import "KBPGPDecryptView.h"
#import "KBPGPOutputView.h"

@interface KBPGPDecryptAppView ()
@property KBPGPDecryptView *decryptView;
@property KBPGPOutputView *outputView;
@end

@implementation KBPGPDecryptAppView

- (void)viewInit {
  [super viewInit];

  KBSplitView *view = [[KBSplitView alloc] init];
  view.dividerRatio = .50;
  [self addSubview:view];

  GHWeakSelf gself = self;
  _decryptView = [[KBPGPDecryptView alloc] init];
  _decryptView.onDecrypt = ^(KBPGPDecryptView *view, KBPGPDecrypted *decrypted) {
    NSString *text = [[NSString alloc] initWithData:decrypted.stream.writer.data encoding:NSUTF8StringEncoding];
    [gself.outputView setText:text];
    [gself.outputView setPgpSigVerification:decrypted.pgpSigVerification];
  };

  _outputView = [[KBPGPOutputView alloc] init];
  _outputView.footerView.editButton.hidden = YES;
  _outputView.footerView.closeButton.hidden = YES;

  [view setLeftView:_decryptView];
  [view setRightView:_outputView];

  self.viewLayout = [YOLayout fill:view];
}

- (void)setClient:(KBRPClient *)client {
  [super setClient:client];
  _decryptView.client = client;
}

@end
