//
//  KBPGPOutputView.m
//  Keybase
//
//  Created by Gabriel on 3/23/15.
//  Copyright (c) 2015 Gabriel Handford. All rights reserved.
//

#import "KBPGPOutputView.h"
#import "KBFileIcon.h"

@interface KBPGPOutputView ()
@property KBTextView *outputView;
@property YOBox *files;
@property NSData *data;
@end

@implementation KBPGPOutputView

- (void)viewInit {
  [super viewInit];

  _outputView = [[KBTextView alloc] init];
  _outputView.view.editable = NO;
  _outputView.borderType = NSBezelBorder;
  [self addSubview:_outputView];

  YOBox *footerView = [YOBox box:@{@"spacing": @"10", @"minSize": @"130,0"}];
  NSImage *backImage = [NSImage imageNamed:@"46-Arrows-black-arrow-67-24"];
  backImage.size = CGSizeMake(12, 12);
  KBButton *editButton = [KBButton buttonWithText:@"Edit" image:backImage style:KBButtonStyleDefault];
  editButton.targetBlock = ^{
    [self.navigation popViewAnimated:YES];
  };
  [footerView addSubview:editButton];
//  NSImage *shareImage = [NSImage imageNamed:NSImageNameShareTemplate];
//  shareImage.size = CGSizeMake(16, 16);
  KBButton *shareButton = [KBButton buttonWithText:@"Share" style:KBButtonStyleDefault];
  [footerView addSubview:shareButton];

  YOHBox *footerRightView = [YOHBox box:@{@"spacing": @"10", @"minSize": @"130,0", @"horizontalAlignment": @"right"}];
  KBButton *closeButton = [KBButton buttonWithText:@"Done" style:KBButtonStyleDefault];
  closeButton.targetBlock = ^{ [[self window] close]; };
  [footerRightView addSubview:closeButton];
  [footerView addSubview:footerRightView];
  [self addSubview:footerView];

  self.viewLayout = [YOLayout layoutWithLayoutBlock:[KBLayouts borderLayoutWithCenterView:_outputView topView:nil bottomView:footerView insets:UIEdgeInsetsMake(20, 20, 20, 20) spacing:20 maxSize:CGSizeMake(800, 400)]];
}

- (void)setText:(NSString *)text {
  [_outputView setText:text font:[NSFont fontWithName:@"Monaco" size:11] color:KBAppearance.currentAppearance.textColor];
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
