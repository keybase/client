//
//  KBPGPOutputView.m
//  Keybase
//
//  Created by Gabriel on 3/23/15.
//  Copyright (c) 2015 Gabriel Handford. All rights reserved.
//

#import "KBPGPOutputView.h"
#import "KBFileIcon.h"
#import "KBPGPOutputFooterView.h"

@interface KBPGPOutputView ()
@property KBTextView *textView;
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

  KBPGPOutputFooterView *footerView = [[KBPGPOutputFooterView alloc] init];
  footerView.editButton.targetBlock = ^{
    [self.navigation popViewAnimated:YES];
  };
  footerView.closeButton.targetBlock = ^{ [[self window] close]; };
  [self addSubview:footerView];

  self.viewLayout = [YOLayout layoutWithLayoutBlock:[KBLayouts borderLayoutWithCenterView:_textView topView:nil bottomView:footerView insets:UIEdgeInsetsZero spacing:0 maxSize:CGSizeMake(800, 400)]];
}

- (void)setText:(NSString *)text {
  [_textView setText:text style:KBTextStyleMonospace];
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
