//
//  KBPGPSignFooterView.m
//  Keybase
//
//  Created by Gabriel on 3/27/15.
//  Copyright (c) 2015 Gabriel Handford. All rights reserved.
//

#import "KBPGPSignFooterView.h"

@implementation KBPGPSignFooterView

- (void)viewInit {
  [super viewInit];
  [self kb_setBackgroundColor:KBAppearance.currentAppearance.secondaryBackgroundColor];

  [self addSubview:[KBBox horizontalLine]];

  YOView *buttonsView = [YOView view];
  _signButton = [KBButton buttonWithText:@"Sign" style:KBButtonStylePrimary];
  [buttonsView addSubview:_signButton];

  _detached = [KBButton buttonWithText:@"Detached" style:KBButtonStyleCheckbox];
  [buttonsView addSubview:_detached];

  _clearSign = [KBButton buttonWithText:@"Clearsign" style:KBButtonStyleCheckbox];
  [buttonsView addSubview:_clearSign];

  YOSelf yself = self;
  buttonsView.viewLayout = [YOLayout layoutWithLayoutBlock:^CGSize(id<YOLayout> layout, CGSize size) {
    CGFloat y = 20;
    CGSize buttonSize = [yself.signButton sizeThatFits:size];
    [layout setFrame:CGRectMake(size.width - buttonSize.width - 20, y, buttonSize.width, buttonSize.height) view:yself.signButton];

    CGFloat x = 20;
    if (!yself.detached.hidden) {
      x += [layout sizeToFitHorizontalInFrame:CGRectMake(x, y, 0, buttonSize.height) view:yself.detached].size.width + 20;
    }
    if (!yself.clearSign.hidden) {
      x += [layout sizeToFitHorizontalInFrame:CGRectMake(x, y, 0, buttonSize.height) view:yself.clearSign].size.width + 20;
    }

    y += buttonSize.height + 20;
    return CGSizeMake(size.width, y);
  }];
  [self addSubview:buttonsView];
}

@end
