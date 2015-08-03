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
#import "KBPGPVerifyFooterView.h"
#import "KBFileSelectView.h"
#import "KBPGPTextView.h"
#import "KBPGPDecrypt.h"
#import "KBWork.h"

@interface KBPGPVerifyView ()
@property KBPGPTextView *textView;
@property KBPGPVerifyFooterView *footerView;
@property KBPGPDecrypt *decrypter;
@end

@implementation KBPGPVerifyView

- (void)viewInit {
  [super viewInit];

  GHWeakSelf gself = self;
  _textView = [[KBPGPTextView alloc] init];
  [self addSubview:_textView];

  _footerView = [[KBPGPVerifyFooterView alloc] init];
  _footerView.verifyButton.targetBlock = ^{ [gself verify]; };
  [self addSubview:_footerView];

  self.viewLayout = [YOVBorderLayout layoutWithCenter:_textView top:nil bottom:@[_footerView] insets:UIEdgeInsetsZero spacing:0];
}

- (void)setData:(NSData *)data armored:(BOOL)armored {
  [_textView setData:data armored:armored];
}

- (void)viewDidAppear:(BOOL)animated {
  [self.window makeFirstResponder:_textView.view];
}

- (void)verify {
  NSData *signatureData = [_textView.text dataUsingEncoding:NSUTF8StringEncoding];

  if (signatureData.length == 0) {
    [KBActivity setError:KBErrorAlert(@"Nothing to verify.") sender:_textView];
    return;
  }

  // Decrypt and assert signed so we get both the verification and the data.
  // If you wanted only the verification you should user KBPGPVerify.
  // This isn't working see https://github.com/keybase/client/issues/475
  _decrypter = [[KBPGPDecrypt alloc] init];

  KBReader *reader = [KBReader readerWithData:signatureData];
  KBWriter *writer = [KBWriter writer];
  KBStream *stream = [KBStream streamWithReader:reader writer:writer label:arc4random()];
  KBRPGPDecryptOptions *options = [[KBRPGPDecryptOptions alloc] init];
  options.assertSigned = YES;

  [KBActivity setProgressEnabled:YES sender:self];
  [_decrypter decryptWithOptions:options streams:@[stream] client:self.client sender:self completion:^(NSArray *works) {
    NSError *error = [works[0] error];
    [KBActivity setProgressEnabled:NO sender:self];
    if ([KBActivity setError:error sender:self]) return;
    KBWork *work = works[0];
    KBPGPDecrypted *decrypted = [work output];
    if (self.onVerify) {
      self.onVerify(self, decrypted);
    } else {
      [self _verified:decrypted];
    }
  }];
}

- (void)_verified:(KBPGPDecrypted *)decrypted {
  KBRPGPSigVerification *pgpSigVerification = decrypted.pgpSigVerification;
  if (pgpSigVerification.verified) {
    NSString *title = NSStringWithFormat(@"Verified from %@", pgpSigVerification.signer.username);
    NSString *description = NSStringWithFormat(@"Verified from %@ with PGP key fingerprint %@", pgpSigVerification.signer.username, pgpSigVerification.signKey.PGPFingerprint);
    [KBAlert promptWithTitle:title description:description style:NSInformationalAlertStyle buttonTitles:@[@"OK"] view:self completion:^(NSModalResponse returnCode) { }];
  } else {
    [KBActivity setError:KBErrorAlert(@"Unable to verify") sender:self];
  }
}

@end
