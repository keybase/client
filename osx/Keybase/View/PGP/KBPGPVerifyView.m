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
#import "KBPGPOutputView.h"
#import "KBPGPVerify.h"
#import "KBPGPVerifyFooterView.h"

@interface KBPGPVerifyView ()
@property KBTextView *textView;
@property KBPGPVerifyFooterView *footerView;
@property KBPGPVerify *verifier;
@end

@implementation KBPGPVerifyView

- (void)viewInit {
  [super viewInit];

  _textView = [[KBTextView alloc] init];
  _textView.view.editable = YES;
  _textView.view.textContainerInset = CGSizeMake(10, 10);
  [self addSubview:_textView];

  GHWeakSelf gself = self;
  _footerView = [[KBPGPVerifyFooterView alloc] init];
  _footerView.verifyButton.targetBlock = ^{ [gself verify]; };
  [self addSubview:_footerView];

  self.viewLayout = [YOLayout layoutWithLayoutBlock:[KBLayouts borderLayoutWithCenterView:_textView topView:nil bottomView:_footerView insets:UIEdgeInsetsZero spacing:0 maxSize:CGSizeMake(800, 400)]];
}

- (void)setASCIIData:(NSData *)data {
  [_textView setText:[[NSString alloc] initWithData:data encoding:NSASCIIStringEncoding] style:KBTextStyleMonospace];
}

- (void)verify {
  _verifier = [[KBPGPVerify alloc] init];
  KBRPgpVerifyOptions *options = [[KBRPgpVerifyOptions alloc] init];
  options.clearsign = YES;

  NSData *data = [_textView.text dataUsingEncoding:NSASCIIStringEncoding];
  KBReader *reader = [KBReader readerWithData:data];
  KBStream *stream = [KBStream streamWithReader:reader writer:nil binary:NO];

  self.navigation.progressEnabled = YES;
  [_verifier verifyWithOptions:options streams:@[stream] client:self.client sender:self completion:^(NSError *error, NSArray *streams) {
    self.navigation.progressEnabled = NO;
    if ([self.navigation setError:error sender:self]) return;

    [KBAlert promptWithTitle:@"OK" description:@"Verified OK" style:NSInformationalAlertStyle buttonTitles:@[@"OK"] view:self completion:^(NSModalResponse returnCode) { }];
  }];
}

@end
