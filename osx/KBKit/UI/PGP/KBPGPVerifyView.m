//
//  KBPGPVerifyView.m
//  Keybase
//
//  Created by Gabriel on 3/27/15.
//  Copyright (c) 2015 Gabriel Handford. All rights reserved.
//

#import "KBPGPVerifyView.h"

#import "KBRPC.h"
#import "KBStream.h"
#import "KBFileReader.h"
#import "KBPGPOutputView.h"
#import "KBPGPVerify.h"
#import "KBPGPVerifyFooterView.h"
#import "KBFileSelectView.h"
#import "KBPGPTextView.h"

@interface KBPGPVerifyView ()
@property KBPGPTextView *textView;
@property KBPGPVerifyFooterView *footerView;
@property KBPGPVerify *verifier;
@end

@implementation KBPGPVerifyView

- (void)viewInit {
  [super viewInit];

  GHWeakSelf gself = self;
  _textView = [[KBPGPTextView alloc] init];
  _textView.onChange = ^(KBTextView *textView) {
    gself.onVerify(gself, nil);
  };
  [self addSubview:_textView];

  _footerView = [[KBPGPVerifyFooterView alloc] init];
  _footerView.verifyButton.targetBlock = ^{ [gself verify]; };
  [self addSubview:_footerView];

  self.viewLayout = [YOBorderLayout layoutWithCenter:_textView top:nil bottom:@[_footerView] insets:UIEdgeInsetsZero spacing:0];
}

- (void)setData:(NSData *)data armored:(BOOL)armored {
  [_textView setData:data armored:armored];
}

- (void)viewDidAppear:(BOOL)animated {
  [self.window makeFirstResponder:_textView.view];
}

- (void)verify {
  _verifier = [[KBPGPVerify alloc] init];
  KBRPgpVerifyOptions *options = [[KBRPgpVerifyOptions alloc] init];

  NSData *signatureData = [_textView.text dataUsingEncoding:NSUTF8StringEncoding];

  if (signatureData.length == 0) {
    [KBActivity setError:KBErrorAlert(@"Nothing to verify.") sender:_textView];
    return;
  }

  KBStream *stream = nil;
  KBReader *reader = [KBReader readerWithData:signatureData];
  stream = [KBStream streamWithReader:reader writer:nil label:arc4random()];

  [KBActivity setProgressEnabled:YES sender:self];
  [_verifier verifyWithOptions:options stream:stream client:self.client sender:self completion:^(NSError *error, KBStream *stream, KBRPgpSigVerification *pgpSigVerification) {
    [KBActivity setProgressEnabled:NO sender:self];
    if ([KBActivity setError:error sender:self]) return;

    if (self.onVerify) {
      self.onVerify(self, pgpSigVerification);
    } else {
      [self _verified:pgpSigVerification];
    }
  }];
}

- (void)_verified:(KBRPgpSigVerification *)pgpSigVerification {
  if (pgpSigVerification.verified) {
    NSString *title = NSStringWithFormat(@"Verified from %@", pgpSigVerification.signer.username);
    NSString *description = NSStringWithFormat(@"Verified from %@ with PGP key fingerprint %@", pgpSigVerification.signer.username, pgpSigVerification.signKey.PGPFingerprint);
    [KBAlert promptWithTitle:title description:description style:NSInformationalAlertStyle buttonTitles:@[@"OK"] view:self completion:^(NSModalResponse returnCode) { }];
  } else {
    [KBActivity setError:KBMakeError(-1, @"Unable to verify") sender:self];
  }
}

@end
