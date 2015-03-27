//
//  KBPGPEncryptFooterView.m
//  Keybase
//
//  Created by Gabriel on 3/25/15.
//  Copyright (c) 2015 Gabriel Handford. All rights reserved.
//

#import "KBPGPEncryptFooterView.h"

@implementation KBPGPEncryptFooterView

- (void)viewInit {
  [super viewInit];
  self.wantsLayer = YES;
  self.layer.backgroundColor = KBAppearance.currentAppearance.secondaryBackgroundColor.CGColor;

  [self addSubview:[KBBox horizontalLine]];

  YOView *buttonsView = [YOView view];
  _encryptButton = [KBButton buttonWithText:@"Encrypt" style:KBButtonStylePrimary];
  [buttonsView addSubview:_encryptButton];

  _signButton = [KBButton buttonWithText:@"Sign" style:KBButtonStyleCheckbox];
  _signButton.state = NSOnState;
  [buttonsView addSubview:_signButton];

  _includeSelfButton = [KBButton buttonWithText:@"Include self" style:KBButtonStyleCheckbox];
  _includeSelfButton.state = NSOnState;
  [buttonsView addSubview:_includeSelfButton];

//  NSImage *attachmentImage = [NSImage imageNamed:@"1-Edition-black-clip-1-24"];
//  attachmentImage.size = CGSizeMake(16, 16);
//  _attachmentButton = [KBButton buttonWithImage:attachmentImage style:KBButtonStyleToolbar];
//  [buttonsView addSubview:_attachmentButton];

  YOSelf yself = self;
  buttonsView.viewLayout = [YOLayout layoutWithLayoutBlock:^CGSize(id<YOLayout> layout, CGSize size) {
    CGFloat y = 20;
    CGSize buttonSize = [yself.encryptButton sizeThatFits:size];
    [layout setFrame:CGRectMake(size.width - buttonSize.width - 20, y, buttonSize.width, buttonSize.height) view:yself.encryptButton];

    CGFloat x = 20;
    x += [layout sizeToFitHorizontalInFrame:CGRectMake(x, y, 0, buttonSize.height) view:yself.signButton].size.width + 20;
    x += [layout sizeToFitHorizontalInFrame:CGRectMake(x, y, 0, buttonSize.height) view:yself.includeSelfButton].size.width + 20;
    //x += [layout sizeToFitHorizontalInFrame:CGRectMake(x, y, 0, buttonSize.height) view:yself.attachmentButton].size.width + 20;

    y += buttonSize.height + 20;
    return CGSizeMake(size.width, y);
  }];
  [self addSubview:buttonsView];
}

@end
