//
//  KBPGPEncryptView.m
//  Keybase
//
//  Created by Gabriel on 3/20/15.
//  Copyright (c) 2015 Gabriel Handford. All rights reserved.
//

#import "KBPGPEncryptView.h"

#import "KBUserProfileView.h"
#import "KBReader.h"
#import "KBWriter.h"
#import "KBPGPOutputView.h"
#import "KBPGPEncrypt.h"
#import "KBRPC.h"
#import "KBPGPEncryptFooterView.h"

@interface KBPGPEncryptView ()
@property KBUserPickerView *userPickerView;

@property KBScrollView *scrollView;
@property KBTextView *textView;

@property KBPGPEncryptFooterView *footerView;

@property KBPGPEncrypt *encrypter;
@end

@implementation KBPGPEncryptView

- (void)viewInit {
  [super viewInit];

  YOVBox *topView = [YOVBox box];
  [self addSubview:topView];
  _userPickerView = [[KBUserPickerView alloc] init];
  _userPickerView.delegate = self;
  [topView addSubview:_userPickerView];
  [topView addSubview:[KBBox horizontalLine]];

  _textView = [[KBTextView alloc] init];
  _textView.textView.textContainerInset = CGSizeMake(20, 16);

  _scrollView = [[KBScrollView alloc] init];
  [_scrollView setDocumentView:_textView];
  [self addSubview:_scrollView];

  GHWeakSelf gself = self;
  _footerView = [[KBPGPEncryptFooterView alloc] init];
  _footerView.encryptButton.targetBlock = ^{ [gself encrypt]; };
  _footerView.signButton.state = NSOnState;
  _footerView.includeSelfButton.state = NSOnState;
  [self addSubview:_footerView];

  // Search results from picker view is here so we can float it
  [self addSubview:_userPickerView.searchResultsView];

  self.viewLayout = [YOLayout layoutWithLayoutBlock:[KBLayouts borderLayoutWithCenterView:_scrollView topView:topView bottomView:_footerView insets:UIEdgeInsetsZero spacing:0 maxSize:CGSizeMake(600, 450)]];
}

- (void)layout {
  [super layout];
  CGFloat y2 = CGRectGetMaxY(self.userPickerView.frame);
  CGSize size = self.frame.size;
  _userPickerView.searchResultsView.frame = CGRectMake(40, y2, size.width - 40, _scrollView.frame.size.height + 2);
}

- (void)encrypt {
  //NSString *outputPath = [NSTemporaryDirectory() stringByAppendingPathComponent:NSStringWithFormat(@"%@", NSUUID.UUID.UUIDString)];
  NSString *text = _textView.text;

  KBReader *reader = [KBReader readerWithData:[text dataUsingEncoding:NSUTF8StringEncoding]];
  KBWriter *writer = [KBWriter writer];

  _encrypter = [[KBPGPEncrypt alloc] init];
  KBRPgpEncryptOptions *options = [[KBRPgpEncryptOptions alloc] init];
  options.recipients = _userPickerView.usernames;
  options.noSelf = _footerView.includeSelfButton.state != NSOnState;
  options.noSign = _footerView.signButton.state != NSOnState;
  self.navigation.progressEnabled = YES;
  //GHWeakSelf gself = self;
  [_encrypter encryptWithOptions:options reader:reader writer:writer client:self.client sender:self completion:^(NSError *error) {
    self.navigation.progressEnabled = NO;
    if ([self.navigation setError:error sender:self]) return;

    [self showOutput:writer.data];
  }];
}

- (void)showOutput:(NSData *)data {
  KBPGPOutputView *outputView = [[KBPGPOutputView alloc] init];
  [outputView setArmoredData:data];
  //[self.navigation pushView:outputView animated:YES];
  
}

- (void)userPickerViewDidUpdate:(KBUserPickerView *)userPickerView {
  CGSize size = userPickerView.frame.size;
  CGSize sizeThatFits = [userPickerView sizeThatFits:self.frame.size];
  if (sizeThatFits.height > size.height) {
    [self layoutView];
  }
}

@end
