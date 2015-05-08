//
//  KBPGPOutputView.m
//  Keybase
//
//  Created by Gabriel on 3/23/15.
//  Copyright (c) 2015 Gabriel Handford. All rights reserved.
//

#import "KBPGPOutputView.h"
#import "KBFileIcon.h"
#import "KBPGPVerifiedView.h"
#import "KBPGPOutputFooterView.h"
#import <YOLayout/YOBorderLayout.h>

@interface KBPGPOutputView ()
@property KBTextView *textView;
@property KBPGPVerifiedView *verifiedView;
@property KBPGPOutputFooterView *footerView;

@property YOBox *files;
@property NSData *data;
@end

@implementation KBPGPOutputView

- (void)viewInit {
  [super viewInit];

  _textView = [[KBTextView alloc] init];
  _textView.view.editable = NO;
  _textView.view.textContainerInset = CGSizeMake(10, 10);
  [self addSubview:_textView];

  _verifiedView = [[KBPGPVerifiedView alloc] init];
  [self addSubview:_verifiedView];

  GHWeakSelf gself =self;
  _footerView = [[KBPGPOutputFooterView alloc] init];
  _footerView.editButton.targetBlock = ^{
    [gself.navigation popViewAnimated:YES];
  };
  _footerView.closeButton.targetBlock = ^{ [[gself window] close]; };
  [self addSubview:_footerView];

  self.viewLayout = [YOBorderLayout layoutWithCenter:_textView top:nil bottom:@[_verifiedView, _footerView] insets:UIEdgeInsetsZero spacing:0];
}

- (void)setText:(NSString *)text {
  [_textView setText:text style:KBTextStyleDefault options:KBTextOptionsMonospace alignment:NSLeftTextAlignment lineBreakMode:NSLineBreakByClipping];
  [self setNeedsLayout];
}

- (void)setASCIIData:(NSData *)data {
  NSParameterAssert(data);
  NSString *armored = [[NSString alloc] initWithData:data encoding:NSASCIIStringEncoding];

  if (!armored) {
    armored = [[NSString alloc] initWithBytes:data.bytes length:data.length encoding:NSStringEncodingConversionAllowLossy];
  }

  [self setText:armored];
}

//- (void)share {
//  NSSharingServicePicker *sharingServicePicker = [[NSSharingServicePicker alloc] initWithItems:urls];
//  sharingServicePicker.delegate = self;
//
//  [sharingServicePicker showRelativeToRect:[sender bounds] ofView:sender preferredEdge:NSMinYEdge];
//}

- (void)setPgpSigVerification:(KBRPgpSigVerification *)pgpSigVerification {
  _verifiedView.pgpSigVerification = pgpSigVerification;
  [self setNeedsLayout];
}


- (void)save {
  NSSavePanel *panel = [NSSavePanel savePanel];
  panel.allowedFileTypes = @[@"gpg"];
  panel.allowsOtherFileTypes = YES;
  panel.canCreateDirectories = YES;
  panel.canSelectHiddenExtension = YES;

  GHWeakSelf gself = self;
  [panel beginSheetModalForWindow:self.window completionHandler:^(NSInteger result) {
    if (result == NSFileHandlingPanelOKButton) {
      NSError *error = nil;
      NSURL *URL = [panel URL];
      if ([URL isFileURL]) {
        [gself.data writeToFile:[URL path] options:NSDataWritingAtomic error:&error];
      }
    }
  }];
}

@end
