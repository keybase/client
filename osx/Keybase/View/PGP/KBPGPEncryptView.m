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

@interface KBPGPEncryptView ()
@property KBTextView *userPickerView;
@property KBTextView *textView;

@property KBPGPEncrypt *encrypter;
@end

@implementation KBPGPEncryptView

- (void)viewInit {
  [super viewInit];

//  _userPickerView = [[KBTextView alloc] init];
//  [self addSubview:_userPickerView];

  _textView = [[KBTextView alloc] init];
  [self addSubview:_textView];

  YOView *footerView = [YOHBox box:@{@"spacing": @"10", @"minSize": @"130,0", @"horizontalAlignment": @"right"}];
  KBButton *cancelButton = [KBButton buttonWithText:@"Cancel" style:KBButtonStyleDefault];
  cancelButton.targetBlock = ^{ [[self window] close]; };
  [footerView addSubview:cancelButton];
  KBButton *button = [KBButton buttonWithText:@"Encrypt" style:KBButtonStylePrimary];
  button.targetBlock = ^{ [self encrypt]; };
  [footerView addSubview:button];
  [self addSubview:footerView];

  self.viewLayout = [YOLayout layoutWithLayoutBlock:[KBLayouts borderLayoutWithCenterView:_textView topView:_userPickerView bottomView:footerView insets:UIEdgeInsetsMake(20, 20, 20, 20) spacing:20 maxSize:CGSizeMake(800, 400)]];
}

- (void)encrypt {
  //NSString *outputPath = [NSTemporaryDirectory() stringByAppendingPathComponent:NSStringWithFormat(@"%@", NSUUID.UUID.UUIDString)];
  NSString *text = _textView.text;

  KBReader *reader = [KBReader readerWithData:[text dataUsingEncoding:NSUTF8StringEncoding]];
  KBWriter *writer = [KBWriter writer];

  _encrypter = [[KBPGPEncrypt alloc] init];
  KBRPgpEncryptOptions *options = [[KBRPgpEncryptOptions alloc] init];
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
  [self.navigation pushView:outputView animated:YES];
}

@end
