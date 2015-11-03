//
//  KBPGPVerifyDetachedView.m
//  Keybase
//
//  Created by Gabriel on 6/5/15.
//  Copyright (c) 2015 Gabriel Handford. All rights reserved.
//

#import "KBPGPVerifyDetachedView.h"

#import "KBRPC.h"
#import "KBStream.h"
#import "KBFileReader.h"
#import "KBPGPOutputView.h"
#import "KBPGPVerify.h"
#import "KBPGPVerifyFooterView.h"
#import "KBFileSelectView.h"
#import "KBPGPTextView.h"

@interface KBPGPVerifyDetachedView ()
@property KBPGPTextView *textView;
@property KBFileSelectView *fileSelectView;
@property KBPGPVerifyFooterView *footerView;
@property KBPGPVerify *verifier;
@end

@implementation KBPGPVerifyDetachedView

- (void)viewInit {
  [super viewInit];

  YOVBox *topView = [YOVBox box];
  [self addSubview:topView];

  _textView = [[KBPGPTextView alloc] init];
  [self addSubview:_textView];

  YOVBox *bottomView = [YOVBox box];
  [self addSubview:bottomView];
  [bottomView addSubview:[KBBox horizontalLine]];
  _fileSelectView = [[KBFileSelectView alloc] init];
  [_fileSelectView setLabelText:@"File:"];
  [bottomView addSubview:_fileSelectView];

  GHWeakSelf gself = self;
  _footerView = [[KBPGPVerifyFooterView alloc] init];
  _footerView.verifyButton.targetBlock = ^{ [gself verify]; };
  [bottomView addSubview:_footerView];

  self.viewLayout = [YOVBorderLayout layoutWithCenter:_textView top:nil bottom:@[bottomView]];
}

- (void)setData:(NSData *)data armored:(BOOL)armored {
  [_textView setData:data armored:armored];
}

- (void)viewDidAppear:(BOOL)animated {
  [self.window makeFirstResponder:_textView.view];
}

- (void)verify {
  _verifier = [[KBPGPVerify alloc] init];
  KBRPGPVerifyOptions *options = [[KBRPGPVerifyOptions alloc] init];

  NSData *signatureData = [_textView.text dataUsingEncoding:NSUTF8StringEncoding];
  NSString *filePath = [_fileSelectView path];

  if (!filePath && signatureData.length == 0) {
    [KBActivity setError:KBErrorAlert(@"Nothing to verify.") sender:_textView];
    return;
  }

  KBStream *stream = nil;
  if (filePath) {
    KBFileReader *fileReader = [KBFileReader fileReaderWithPath:filePath];
    stream = [KBStream streamWithReader:fileReader writer:nil label:arc4random()];
    options.signature = signatureData;
  } else {
    KBReader *reader = [KBReader readerWithData:signatureData];
    stream = [KBStream streamWithReader:reader writer:nil label:arc4random()];
    //options.signature = signatureData;
  }

  [KBActivity setProgressEnabled:YES sender:self];
  [_verifier verifyWithOptions:options stream:stream client:self.client sender:self completion:^(NSError *error, KBStream *stream, KBRPGPSigVerification *pgpSigVerification) {
    [KBActivity setProgressEnabled:NO sender:self];
    if ([KBActivity setError:error sender:self]) return;

    if (self.onVerify) {
      self.onVerify(self, pgpSigVerification);
    } else {
      [self _verified:pgpSigVerification];
    }
  }];
}

- (void)_verified:(KBRPGPSigVerification *)pgpSigVerification {
  if (pgpSigVerification.verified) {
    NSString *title = NSStringWithFormat(@"Verified from %@", pgpSigVerification.signer.username);
    NSString *description = NSStringWithFormat(@"Verified from %@ with PGP key fingerprint %@", pgpSigVerification.signer.username, pgpSigVerification.signKey.PGPFingerprint);
    [KBAlert promptWithTitle:title description:description style:NSInformationalAlertStyle buttonTitles:@[@"OK"] view:self completion:^(NSModalResponse returnCode) { }];
  } else {
    [KBActivity setError:KBErrorAlert(@"Unable to verify") sender:self];
  }
}

@end

