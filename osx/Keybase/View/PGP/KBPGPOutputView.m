//
//  KBPGPOutputView.m
//  Keybase
//
//  Created by Gabriel on 3/23/15.
//  Copyright (c) 2015 Gabriel Handford. All rights reserved.
//

#import "KBPGPOutputView.h"

@interface KBPGPOutputView ()
@property KBLabel *outputView;
@property NSData *data;
@end

@implementation KBPGPOutputView

- (void)viewInit {
  [super viewInit];

  _outputView = [[KBLabel alloc] init];
  _outputView.selectable = YES;
  _outputView.insets = UIEdgeInsetsMake(10, 10, 10, 10);
  [self addSubview:_outputView];

  KBScrollView *scrollView = [[KBScrollView alloc] init];
  [scrollView setDocumentView:_outputView];
  [scrollView setBorderEnabled:YES];
  [self addSubview:scrollView];

  YOView *footerView = [YOHBox box:@{@"spacing": @"10", @"minSize": @"130,0", @"horizontalAlignment": @"right"}];
  KBButton *closeButton = [KBButton buttonWithText:@"Close" style:KBButtonStyleDefault];
  closeButton.targetBlock = ^{ [[self window] close]; };
  [footerView addSubview:closeButton];
  [self addSubview:footerView];

  self.viewLayout = [YOLayout layoutWithLayoutBlock:[KBLayouts borderLayoutWithCenterView:scrollView topView:nil bottomView:footerView insets:UIEdgeInsetsMake(20, 20, 20, 20) spacing:20 maxSize:CGSizeMake(800, 400)]];
}

- (void)setArmoredData:(NSData *)data {
  NSParameterAssert(data);
  NSString *armored = [[NSString alloc] initWithData:data encoding:NSASCIIStringEncoding];

  if (!armored) {
    armored = [[NSString alloc] initWithBytes:data.bytes length:data.length encoding:NSStringEncodingConversionAllowLossy];
  }

  [_outputView setText:armored font:[NSFont fontWithName:@"Monaco" size:11] color:KBAppearance.currentAppearance.textColor alignment:NSLeftTextAlignment lineBreakMode:NSLineBreakByWordWrapping];
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
