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

@interface KBPGPVerifyView ()
@property KBTextView *textView;
@property KBFileSelectView *fileSelectView;
@property KBPGPVerifyFooterView *footerView;
@property KBPGPVerify *verifier;
@end

@implementation KBPGPVerifyView

- (void)viewInit {
  [super viewInit];

  YOVBox *topView = [YOVBox box];
  [self addSubview:topView];

  KBLabel *labelView = [KBLabel labelWithText:@"Paste the signature message here. For detached signatures, you'll need to specify the file to verify against." style:KBTextStyleDefault];
  labelView.insets = UIEdgeInsetsMake(20, 20, 20, 20);
  [topView addSubview:labelView];
  [topView addSubview:[KBBox horizontalLine]];

  _textView = [[KBTextView alloc] init];
  _textView.view.editable = YES;
  _textView.view.textContainerInset = CGSizeMake(10, 10);
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

  self.viewLayout = [YOLayout layoutWithLayoutBlock:[KBLayouts borderLayoutWithCenterView:_textView topView:topView bottomView:bottomView insets:UIEdgeInsetsZero spacing:0 maxSize:CGSizeMake(800, 400)]];
}

- (void)setASCIIData:(NSData *)data {
  [_textView setText:[[NSString alloc] initWithData:data encoding:NSASCIIStringEncoding] style:KBTextStyleDefault options:KBTextOptionsMonospace alignment:NSLeftTextAlignment lineBreakMode:NSLineBreakByClipping];
}

- (void)setupResponders {
  [self.window makeFirstResponder:_textView.view];
}

- (void)verify {
  _verifier = [[KBPGPVerify alloc] init];
  KBRPgpVerifyOptions *options = [[KBRPgpVerifyOptions alloc] init];

  NSData *signatureData = [_textView.text dataUsingEncoding:NSASCIIStringEncoding];
  NSString *filePath = [_fileSelectView path];

  if (!filePath && signatureData.length == 0) {
    [self.navigation setError:KBErrorAlert(@"Nothing to verify.") sender:_textView];
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
  [_verifier verifyWithOptions:options stream:stream client:self.client sender:self completion:^(NSError *error, KBStream *stream, KBRPgpSigVerification *pgpSigVerification) {
    [KBActivity setProgressEnabled:NO sender:self];
    if ([KBActivity setError:error sender:self]) return;

    if (self.onVerify) {
      self.onVerify(self);
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
    [self.navigation setError:KBMakeError(-1, @"Unable to verify") sender:self];
  }
}

@end
