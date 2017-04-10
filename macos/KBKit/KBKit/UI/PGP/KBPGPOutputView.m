//
//  KBPGPOutputView.m
//  Keybase
//
//  Created by Gabriel on 3/23/15.
//  Copyright (c) 2015 Gabriel Handford. All rights reserved.
//

#import "KBPGPOutputView.h"
#import "KBFileIcon.h"
#import "KBPGPTextView.h"
#import "KBPGPVerifiedView.h"
#import "KBPGPOutputFooterView.h"

@interface KBPGPOutputView () <NSSharingServicePickerDelegate>
@property KBPGPTextView *textView;
@property KBPGPVerifiedView *verifiedView;
@property KBPGPOutputFooterView *footerView;

@property YOBox *files;
@property NSData *data;
@end

@implementation KBPGPOutputView

- (void)viewInit {
  [super viewInit];

  _textView = [[KBPGPTextView alloc] init];
  _textView.view.editable = NO;
  [self addSubview:_textView];

  _verifiedView = [[KBPGPVerifiedView alloc] init];
  [self addSubview:_verifiedView];

  GHWeakSelf gself = self;
  _footerView = [[KBPGPOutputFooterView alloc] init];
  _footerView.editButton.targetBlock = ^{ [gself.navigation popViewAnimated:YES]; };
  _footerView.shareButton.dispatchBlock = ^(KBButton *button, dispatch_block_t completion) {
    [gself share:button completion:completion];
  };
  _footerView.closeButton.targetBlock = ^{ [[gself window] close]; };
  [self addSubview:_footerView];

  self.viewLayout = [YOVBorderLayout layoutWithCenter:_textView top:nil bottom:@[_verifiedView, _footerView]];
}

- (void)setText:(NSString *)text wrap:(BOOL)wrap {
  [_textView setText:text style:KBTextStyleDefault options:KBTextOptionsMonospace alignment:NSLeftTextAlignment lineBreakMode:(wrap ? NSLineBreakByWordWrapping : NSLineBreakByClipping)];
  [self setNeedsLayout];
}

- (void)setData:(NSData *)data armored:(BOOL)armored {
  [_textView setData:data armored:armored];
}

- (void)clear {
  _textView.attributedText = nil;
  _verifiedView.pgpSigVerification = nil;
  [self setNeedsLayout];
}

- (void)share:(id)sender completion:(dispatch_block_t)completion {
  NSMutableArray *items = [NSMutableArray array];
  if (_textView.isArmored) {
    [items addObject:[[NSString alloc] initWithData:_textView.data encoding:NSUTF8StringEncoding]];
  } else {
    NSAssert(NO, @"TODO Share unsupported");
  }

  NSSharingServicePicker *sharingServicePicker = [[NSSharingServicePicker alloc] initWithItems:items];
  sharingServicePicker.delegate = self;
  [sharingServicePicker showRelativeToRect:[sender bounds] ofView:sender preferredEdge:NSMinYEdge];
  completion();
}

//- (void)mailShare {
//  NSSharingService *mailShare = [NSSharingService sharingServiceNamed:NSSharingServiceNameComposeEmail];
//  NSArray *shareItems = @[]; // @[textAttributedString, tempFileURL];
//  [mailShare performWithItems:shareItems];
//}

- (void)setPgpSigVerification:(KBRPGPSigVerification *)pgpSigVerification {
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
