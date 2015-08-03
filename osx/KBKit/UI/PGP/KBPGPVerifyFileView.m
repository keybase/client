//
//  KBPGPVerifyFileView.m
//  Keybase
//
//  Created by Gabriel on 3/30/15.
//  Copyright (c) 2015 Gabriel Handford. All rights reserved.
//

#import "KBPGPVerifyFileView.h"

#import "KBRPC.h"
#import "KBStream.h"
#import "KBPGPOutputView.h"
#import "KBFileIcon.h"
#import "KBFileReader.h"
#import "KBPGPOutputFileView.h"
#import "KBPGPVerifyFooterView.h"
#import "KBPGPVerify.h"

@interface KBPGPVerifyFileView ()
@property KBButton *chooseButton;
@property KBFileIcon *fileIcon;
@property KBPGPVerifyFooterView *footerView;
@property KBPGPVerify *verifier;
@end

@implementation KBPGPVerifyFileView

- (void)viewInit {
  [super viewInit];

  YOView *contentView = [YOView view];
  [contentView kb_setBackgroundColor:KBAppearance.currentAppearance.backgroundColor];
  [self addSubview:contentView];

  _fileIcon = [[KBFileIcon alloc] init];
  _fileIcon.iconHeight = 400;
  _fileIcon.font = [NSFont systemFontOfSize:18];
  [contentView addSubview:_fileIcon];

  YOSelf yself = self;
  KBButton *chooseButton = [KBButton buttonWithText:@"Choose File" style:KBButtonStyleDefault options:0];
  chooseButton.targetBlock = ^{ [yself chooseInput]; };
  [contentView addSubview:chooseButton];

  contentView.viewLayout = [YOLayout layoutWithLayoutBlock:^CGSize(id<YOLayout> layout, CGSize size) {
    CGFloat y = 20;
    if (yself.fileIcon.file) {
      y += [layout sizeToFitVerticalInFrame:CGRectMake(20, y, size.width - 40, size.height - y - 80) view:yself.fileIcon].size.height + 20;
    }
    y += [layout centerWithSize:CGSizeMake(200, 0) frame:CGRectMake(0, y, size.width, size.height - y - 20) view:chooseButton].size.height + 20;
    return size;
  }];

  GHWeakSelf gself = self;
  _footerView = [[KBPGPVerifyFooterView alloc] init];
  _footerView.verifyButton.targetBlock = ^{ [gself verify]; };
  [self addSubview:_footerView];

  self.viewLayout = [YOVBorderLayout layoutWithCenter:contentView top:nil bottom:@[_footerView] insets:UIEdgeInsetsZero spacing:0];
}

- (void)chooseInput {
  NSOpenPanel *panel = [NSOpenPanel openPanel];
  panel.prompt = @"OK";
  panel.title = @"Choose a file...";
  GHWeakSelf gself = self;
  [panel beginSheetModalForWindow:self.window completionHandler:^(NSInteger result) {
    if (result == NSFileHandlingPanelOKButton) {
      for (NSURL *URL in [panel URLs]) {
        if ([URL isFileURL]) {
          [gself.fileIcon setFile:[KBFile fileWithURL:URL]];
          [self setNeedsLayout];
        }
      }
    }
  }];
}

- (void)verify {
  if (!_fileIcon.file.path) {
    [KBActivity setError:KBErrorAlert(@"Nothing to verify.") sender:self];
    return;
  }

  KBFileReader *fileReader = [KBFileReader fileReaderWithPath:_fileIcon.file.path];
  KBStream *stream = [KBStream streamWithReader:fileReader writer:nil label:arc4random()];

  KBRPGPVerifyOptions *options = [[KBRPGPVerifyOptions alloc] init];

  _verifier = [[KBPGPVerify alloc] init];
  [KBActivity setProgressEnabled:YES sender:self];
  [_verifier verifyWithOptions:options stream:stream client:self.client sender:self completion:^(NSError *error, KBStream *stream, KBRPGPSigVerification *pgpSigVerification) {
    [KBActivity setProgressEnabled:NO sender:self];
    if ([KBActivity setError:error sender:self]) return;

    // TODO: this is copied from KBPGPVerifyView
    if (pgpSigVerification.verified) {
      NSString *title = NSStringWithFormat(@"Verified from %@", pgpSigVerification.signer.username);
      NSString *description = NSStringWithFormat(@"Verified from %@ with PGP key fingerprint %@", pgpSigVerification.signer.username, pgpSigVerification.signKey.PGPFingerprint);
      [KBAlert promptWithTitle:title description:description style:NSInformationalAlertStyle buttonTitles:@[@"OK"] view:self completion:^(NSModalResponse returnCode) { }];
    } else {
      [KBActivity setError:KBErrorAlert(@"Unable to verify") sender:self];
    }
  }];
}

@end
