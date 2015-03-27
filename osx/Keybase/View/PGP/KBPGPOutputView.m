//
//  KBPGPOutputView.m
//  Keybase
//
//  Created by Gabriel on 3/23/15.
//  Copyright (c) 2015 Gabriel Handford. All rights reserved.
//

#import "KBPGPOutputView.h"
#import "KBFileIconLabel.h"

@interface KBPGPOutputView ()
@property KBTextView *outputView;
@property YOBox *files;
@property NSData *data;
@end

@implementation KBPGPOutputView

- (void)viewInit {
  [super viewInit];

  YOVBox *contentView = [YOVBox box];
  [self addSubview:contentView];

  _outputView = [[KBTextView alloc] initWithFrame:CGRectMake(0, 0, 600, 200)];
  _outputView.view.editable = NO;
  _outputView.borderType = NSBezelBorder;
  _outputView.layer.borderColor = NSColor.redColor.CGColor;
  [contentView addSubview:_outputView];

  _files = [YOBox box:@{@"spacing": @(4), @"insets": @(10)}];
  [contentView addSubview:_files];

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

  self.viewLayout = [YOLayout layoutWithLayoutBlock:[KBLayouts borderLayoutWithCenterView:contentView topView:nil bottomView:footerView insets:UIEdgeInsetsMake(20, 20, 20, 20) spacing:20 maxSize:CGSizeMake(800, 400)]];
}

- (void)setArmoredData:(NSData *)data {
  NSParameterAssert(data);
  NSString *armored = [[NSString alloc] initWithData:data encoding:NSASCIIStringEncoding];

  if (!armored) {
    armored = [[NSString alloc] initWithBytes:data.bytes length:data.length encoding:NSStringEncodingConversionAllowLossy];
  }

  [_outputView setText:armored font:[NSFont fontWithName:@"Monaco" size:11] color:KBAppearance.currentAppearance.textColor];
  [self setNeedsLayout];
}

- (void)addFiles:(NSArray *)files {
  for (NSString *file in files) {
    KBFileIconLabel *icon = [[KBFileIconLabel alloc] init];
    icon.iconHeight = 60;
    [icon setPath:file];
    [_files addSubview:icon];
  }
  [_files setNeedsLayout:NO];
  [self layoutView];
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
