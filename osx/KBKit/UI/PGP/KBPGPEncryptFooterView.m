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
  [self kb_setBackgroundColor:KBAppearance.currentAppearance.secondaryBackgroundColor];

  [self addSubview:[KBBox horizontalLine]];

  YOView *buttonsView = [YOView view];
  _encryptButton = [KBButton buttonWithText:@"Encrypt" style:KBButtonStylePrimary];
  [buttonsView addSubview:_encryptButton];

  _cancelButton = [KBButton buttonWithText:@"Cancel" style:KBButtonStyleDefault];
  _cancelButton.hidden = YES;
  [buttonsView addSubview:_cancelButton];

  _signButton = [KBButton buttonWithText:@"Sign" style:KBButtonStyleCheckbox];
  _signButton.state = NSOnState;
  [buttonsView addSubview:_signButton];

  _includeSelfButton = [KBButton buttonWithText:@"Include self" style:KBButtonStyleCheckbox];
  _includeSelfButton.state = NSOnState;
  [buttonsView addSubview:_includeSelfButton];

  YOSelf yself = self;
  buttonsView.viewLayout = [YOLayout layoutWithLayoutBlock:^CGSize(id<YOLayout> layout, CGSize size) {
    CGFloat y = 20;
    CGSize buttonSize = [yself.encryptButton sizeThatFits:size];
    [layout setFrame:CGRectMake(size.width - 130 - 20, y, 130, buttonSize.height) view:yself.encryptButton];

    [layout setFrame:CGRectMake(size.width - 280, y, 130, buttonSize.height) view:yself.cancelButton];

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


@implementation KBPGPEncryptToolbarFooterView

- (void)viewInit {
  [super viewInit];
  [self kb_setBackgroundColor:KBAppearance.currentAppearance.secondaryBackgroundColor];

  [self addSubview:[KBBox horizontalLine]];

  YOView *buttonsView = [YOView view];
  _encryptButton = [KBButton buttonWithText:@"Encrypt" style:KBButtonStylePrimary options:KBButtonOptionsToolbar];
  [buttonsView addSubview:_encryptButton];

  _cancelButton = [KBButton buttonWithText:@"Cancel" style:KBButtonStyleDefault options:KBButtonOptionsToolbar];
  [buttonsView addSubview:_cancelButton];

//  _signButton = [KBButton buttonWithText:@"Sign" style:KBButtonStyleCheckbox];
//  _signButton.state = NSOnState;
//  [buttonsView addSubview:_signButton];
//
//  _includeSelfButton = [KBButton buttonWithText:@"Include self" style:KBButtonStyleCheckbox];
//  _includeSelfButton.state = NSOnState;
//  [buttonsView addSubview:_includeSelfButton];

  YOSelf yself = self;
  buttonsView.viewLayout = [YOLayout layoutWithLayoutBlock:^CGSize(id<YOLayout> layout, CGSize size) {
    CGFloat y = 10;
    CGSize buttonSize = [yself.encryptButton sizeThatFits:size];
    [layout setFrame:CGRectMake(size.width - 100 - 10, y, 100, buttonSize.height) view:yself.encryptButton];

    [layout setFrame:CGRectMake(size.width - 200 - 20, y, 100, buttonSize.height) view:yself.cancelButton];

//    CGFloat x = 20;
//    x += [layout sizeToFitHorizontalInFrame:CGRectMake(x, y, 0, buttonSize.height) view:yself.signButton].size.width + 20;
//    x += [layout sizeToFitHorizontalInFrame:CGRectMake(x, y, 0, buttonSize.height) view:yself.includeSelfButton].size.width + 20;

    y += buttonSize.height + 10;
    return CGSizeMake(size.width, y);
  }];
  [self addSubview:buttonsView];
}

@end

