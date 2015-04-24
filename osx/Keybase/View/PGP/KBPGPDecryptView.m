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
#import "KBPGPDecrypted.h"
#import <YOLayout/YOBorderLayout.h>

@interface KBPGPDecryptView ()
@property KBTextView *textView;
@property KBPGPDecrypt *decrypter;
@end

@implementation KBPGPDecryptView

- (void)viewInit {
  [super viewInit];

  YOView *contentView = [YOView view];
  [self addSubview:contentView];
  _textView = [[KBTextView alloc] init];
  _textView.view.editable = YES;
  _textView.view.textContainerInset = CGSizeMake(10, 10);
  _textView.view.textColor = KBAppearance.currentAppearance.textColor;
  _textView.view.font = [KBAppearance.currentAppearance fontForStyle:KBTextStyleMonospace];
  _textView.onPaste = ^BOOL(KBTextView *textView) {
    NSPasteboard *pasteboard = [NSPasteboard generalPasteboard];
    NSString *str = [pasteboard stringForType:NSPasteboardTypeString];
    [textView setText:str style:KBTextStyleMonospace alignment:NSLeftTextAlignment lineBreakMode:NSLineBreakByClipping];
    return NO;
  };
  [self addSubview:_textView];

  KBPGPDecryptFooterView *footerView = [[KBPGPDecryptFooterView alloc] init];
  footerView.decryptButton.targetBlock = ^{ [self decrypt]; };
  [self addSubview:footerView];

  self.viewLayout = [YOBorderLayout layoutWithCenter:_textView top:nil bottom:@[footerView] insets:UIEdgeInsetsZero spacing:0];
}

- (void)setASCIIData:(NSData *)data {
  [_textView setText:[[NSString alloc] initWithData:data encoding:NSASCIIStringEncoding] style:KBTextStyleMonospace alignment:NSLeftTextAlignment lineBreakMode:NSLineBreakByClipping];
}

- (void)decrypt {
  _decrypter = [[KBPGPDecrypt alloc] init];
  KBRPgpDecryptOptions *options = [[KBRPgpDecryptOptions alloc] init];

  NSData *data = [_textView.text dataUsingEncoding:NSASCIIStringEncoding];
  KBReader *reader = [KBReader readerWithData:data];
  KBWriter *writer = [KBWriter writer];
  KBStream *stream = [KBStream streamWithReader:reader writer:writer label:arc4random()];

  self.navigation.progressEnabled = YES;
  [_decrypter decryptWithOptions:options streams:@[stream] client:self.client sender:self completion:^(NSArray *works) {
    self.navigation.progressEnabled = NO;
    NSError *error = [works[0] error];
    KBPGPDecrypted *decrypted = [works[0] output];
    if ([self.navigation setError:error sender:self]) return;
    [self showOutput:decrypted];
  }];
}

- (void)showOutput:(KBPGPDecrypted *)decrypted {
  KBPGPOutputView *outputView = [[KBPGPOutputView alloc] init];
  NSString *text = [[NSString alloc] initWithData:decrypted.stream.writer.data encoding:NSUTF8StringEncoding];
  [outputView setText:text];
  [outputView setPgpSigVerification:decrypted.pgpSigVerification];
  [self.navigation pushView:outputView animated:YES];
  [self setNeedsLayout];
}

@end
