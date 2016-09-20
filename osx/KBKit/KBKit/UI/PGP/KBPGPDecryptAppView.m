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

#import <YOLayout/YOLayout+PrefabLayouts.h>

@interface KBPGPDecryptAppView ()
@property KBPGPDecryptView *decryptView;
@property KBPGPOutputView *outputView;
@end

@implementation KBPGPDecryptAppView

- (void)viewInit {
  [super viewInit];

  GHWeakSelf gself = self;
  _decryptView = [[KBPGPDecryptView alloc] init];
  _decryptView.onDecrypt = ^(KBPGPDecryptView *view, KBPGPDecrypted *decrypted) {
    if (decrypted) {
      NSString *text = [[NSString alloc] initWithData:decrypted.stream.writer.data encoding:NSUTF8StringEncoding];
      [gself.outputView setText:text wrap:NO];
      [gself.outputView setPgpSigVerification:decrypted.pgpSigVerification];
      [gself.navigation pushView:gself.outputView animated:YES];
    } else {
      [gself.outputView clear];
    }
  };
  [self addSubview:_decryptView];

  _outputView = [[KBPGPOutputView alloc] init];
  _outputView.footerView.closeButton.hidden = YES;

  self.viewLayout = [YOLayout fill:_decryptView];
}

- (void)setClient:(KBRPClient *)client {
  _client = client;
  _decryptView.client = client;
}

@end
