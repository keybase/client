//
//  KBPGPSignView.m
//  Keybase
//
//  Created by Gabriel on 3/27/15.
//  Copyright (c) 2015 Gabriel Handford. All rights reserved.
//

#import "KBPGPSignView.h"

#import "KBRPC.h"
#import "KBStream.h"
#import "KBPGPOutputView.h"
#import "KBPGPSigner.h"
#import "KBPGPSignFooterView.h"
#import "KBWork.h"

@interface KBPGPSignView ()
@property KBTextView *textView;
@property KBPGPSignFooterView *footerView;
@property KBPGPSigner *signer;
@end

@implementation KBPGPSignView

- (void)viewInit {
  [super viewInit];

  _textView = [[KBTextView alloc] init];
  _textView.view.editable = YES;
  _textView.view.textContainerInset = CGSizeMake(10, 10);
  [self addSubview:_textView];

  GHWeakSelf gself = self;
  _footerView = [[KBPGPSignFooterView alloc] init];
  _footerView.detached.hidden = YES;
  _footerView.clearSign.state = NSOnState;
  _footerView.signButton.targetBlock = ^{ [gself sign]; };
  [self addSubview:_footerView];

  self.viewLayout = [YOLayout layoutWithLayoutBlock:[KBLayouts borderLayoutWithCenterView:_textView topView:nil bottomView:_footerView insets:UIEdgeInsetsZero spacing:0 maxSize:CGSizeMake(800, 400)]];
}

- (void)setASCIIData:(NSData *)data {
  [_textView setText:[[NSString alloc] initWithData:data encoding:NSASCIIStringEncoding] style:KBTextStyleDefault options:KBTextOptionsMonospace alignment:NSLeftTextAlignment lineBreakMode:NSLineBreakByClipping];
}

- (void)sign {
  _signer = [[KBPGPSigner alloc] init];
  KBRPgpSignOptions *options = [[KBRPgpSignOptions alloc] init];
  options.mode = _footerView.clearSign.state == NSOnState ? KBRSignModeClear : KBRSignModeAttached;
  options.binaryIn = NO;
  options.binaryOut = NO;

  NSData *data = [_textView.text dataUsingEncoding:NSASCIIStringEncoding];
  KBReader *reader = [KBReader readerWithData:data];
  KBWriter *writer = [KBWriter writer];
  KBStream *stream = [KBStream streamWithReader:reader writer:writer label:arc4random()];

  [KBActivity setProgressEnabled:YES sender:self];
  [_signer signWithOptions:options streams:@[stream] client:self.client sender:self completion:^(NSArray *works) {
    [KBActivity setProgressEnabled:NO sender:self];
    KBWork *work = works[0];
    NSError *error = [work error];
    if ([KBActivity setError:error sender:self]) return;
    KBStream *stream = [work output];

    if ([self.navigation setError:error sender:self]) return;

    if (self.onSign) {
      self.onSign(self, stream.writer.data, options.mode);
    } else {
      [self _sign:stream.writer.data];
    }
  }];
}

- (void)_sign:(NSData *)data {
  KBPGPOutputView *outputView = [[KBPGPOutputView alloc] init];
  NSString *text = [[NSString alloc] initWithData:data encoding:NSUTF8StringEncoding];
  [outputView setText:text];
  [self.navigation pushView:outputView animated:YES];
}

@end

