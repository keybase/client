//
//  KBPGPEncryptActionView.m
//  Keybase
//
//  Created by Gabriel on 6/9/15.
//  Copyright (c) 2015 Keybase. All rights reserved.
//

#import "KBPGPEncryptActionView.h"

#import "KBUserProfileView.h"
#import "KBReader.h"
#import "KBWriter.h"
#import "KBPGPOutputView.h"
#import "KBPGPEncrypt.h"
#import "KBRPC.h"
#import "KBPGPEncryptFooterView.h"
#import "KBFileIcon.h"
#import "KBFileReader.h"
#import "KBFileWriter.h"
#import "KBWork.h"
#import "KBUserPickerView.h"
#import "KBPGPTextView.h"

@interface KBPGPEncryptActionView () <KBUserPickerViewDelegate>
@property KBUserPickerView *userPickerView;
@property KBPGPEncryptToolbarFooterView *footerView;

@property KBPGPEncrypt *encrypter;
@end

@implementation KBPGPEncryptActionView

- (void)viewInit {
  [super viewInit];
  [self kb_setBackgroundColor:KBAppearance.currentAppearance.backgroundColor];

  YOVBox *contentView = [YOVBox box];
  [self addSubview:contentView];

  GHWeakSelf gself = self;
  YOVBox *topView = [YOVBox box];
  [self addSubview:topView];
  _userPickerView = [[KBUserPickerView alloc] init];
  _userPickerView.delegate = self;
  _userPickerView.searchPosition = CGPointMake(1, -1);
  [contentView addSubview:_userPickerView];

  _footerView = [[KBPGPEncryptToolbarFooterView alloc] init];
  _footerView.encryptButton.targetBlock = ^{ [gself encrypt]; };
  _footerView.signButton.state = NSOnState;
  _footerView.includeSelfButton.state = NSOnState;
  _footerView.cancelButton.targetBlock = ^{
    gself.completion(gself, nil);
  };
  [contentView addSubview:_footerView];

  self.viewLayout = [YOLayout layoutWithLayoutBlock:^CGSize(id<YOLayout> layout, CGSize size) {
    if (size.width == 0) size.width = 500;
    return [layout sizeToFitVerticalInFrame:CGRectMake(0, 0, size.width, size.height) view:contentView].size;
  }];
}

- (void)setClient:(KBRPClient *)client {
  [super setClient:client];
  _userPickerView.client = client;
}

- (void)encrypt {
  KBReader *reader = nil;

  NSString *text = _extensionItem.attributedContentText.string;
  BOOL binaryOut = NO;
  if (text) {
    reader = [KBReader readerWithData:[text dataUsingEncoding:NSUTF8StringEncoding]];
    binaryOut = YES;
  }

  if (!reader) {
    [KBActivity setError:KBMakeError(-1, @"Nothing to encrypt") sender:self];
    return;
  }

  KBWriter *writer = [KBWriter writer];
  KBStream *stream = [KBStream streamWithReader:reader writer:writer label:arc4random()];

  _encrypter = [[KBPGPEncrypt alloc] init];
  KBRPgpEncryptOptions *options = [[KBRPgpEncryptOptions alloc] init];
  options.recipients = _userPickerView.usernames;
  //options.noSelf = _footerView.includeSelfButton.state != NSOnState;
  //options.noSign = _footerView.signButton.state != NSOnState;
  options.binaryOut = binaryOut;
  [KBActivity setProgressEnabled:YES sender:self];
  //GHWeakSelf gself = self;
  [_encrypter encryptWithOptions:options streams:@[stream] client:self.client sender:self completion:^(NSArray *works) {
    KBWork *work = works[0];
    NSError *error = [work error];
    [KBActivity setProgressEnabled:NO sender:self];
    if ([KBActivity setError:error sender:self]) return;

    KBStream *stream = [work output];
    if (stream.writer.data) {
      NSExtensionItem *outputItem = [[NSExtensionItem alloc] init];
      if (!binaryOut) {
        NSString *string = [[NSString alloc] initWithData:stream.writer.data encoding:NSUTF8StringEncoding];
        outputItem.attributedContentText = [[NSAttributedString alloc] initWithString:string];
      }
      self.completion(self, outputItem);
    }
  }];
}

- (void)userPickerViewDidUpdate:(KBUserPickerView *)userPickerView {

}

@end