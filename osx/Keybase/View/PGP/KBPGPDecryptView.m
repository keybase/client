//
//  KBPGPDecryptView.m
//  Keybase
//
//  Created by Gabriel on 3/27/15.
//  Copyright (c) 2015 Gabriel Handford. All rights reserved.
//

#import "KBPGPDecryptView.h"

#import "KBRPC.h"
#import "KBStream.h"
#import "KBPGPOutputView.h"
#import "KBPGPDecrypt.h"
#import "KBPGPDecryptFooterView.h"

@interface KBPGPDecryptView ()
@property KBTextView *textView;
@property KBPGPDecrypt *decrypter;
@end

@implementation KBPGPDecryptView

- (void)viewInit {
  [super viewInit];

  _textView = [[KBTextView alloc] init];
  _textView.view.editable = YES;
  _textView.view.textContainerInset = CGSizeMake(10, 10);
  [self addSubview:_textView];

  KBPGPDecryptFooterView *footerView = [[KBPGPDecryptFooterView alloc] init];
  footerView.decryptButton.targetBlock = ^{ [self decrypt]; };
  [self addSubview:footerView];

  self.viewLayout = [YOLayout layoutWithLayoutBlock:[KBLayouts borderLayoutWithCenterView:_textView topView:nil bottomView:footerView insets:UIEdgeInsetsZero spacing:0 maxSize:CGSizeMake(800, 400)]];
}

- (void)setASCIIData:(NSData *)data {
  [_textView setText:[[NSString alloc] initWithData:data encoding:NSASCIIStringEncoding] style:KBTextStyleMonospace];
}

- (void)decrypt {
  _decrypter = [[KBPGPDecrypt alloc] init];
  KBRPgpDecryptOptions *options = [[KBRPgpDecryptOptions alloc] init];

  NSData *data = [_textView.text dataUsingEncoding:NSASCIIStringEncoding];
  KBReader *reader = [KBReader readerWithData:data];
  KBWriter *writer = [KBWriter writer];
  KBStream *stream = [KBStream streamWithReader:reader writer:writer];

  self.navigation.progressEnabled = YES;
  [_decrypter decryptWithOptions:options streams:@[stream] client:self.client sender:self completion:^(NSError *error, NSArray *streams) {
    self.navigation.progressEnabled = NO;
    if ([self.navigation setError:error sender:self]) return;
    KBWriter *writer = (KBWriter *)[streams[0] writer];
    [self showOutput:writer.data];
  }];
}

- (void)showOutput:(NSData *)data {
  KBPGPOutputView *outputView = [[KBPGPOutputView alloc] init];
  NSString *text = [[NSString alloc] initWithData:data encoding:NSUTF8StringEncoding];
  [outputView setText:text];
  [self.navigation pushView:outputView animated:YES];
}

@end
