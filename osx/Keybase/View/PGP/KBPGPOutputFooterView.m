//
//  KBPGPOutputFooterView.m
//  Keybase
//
//  Created by Gabriel on 3/27/15.
//  Copyright (c) 2015 Gabriel Handford. All rights reserved.
//

#import "KBPGPOutputFooterView.h"

@implementation KBPGPOutputFooterView

- (void)viewInit {
  [super viewInit];
  [self addSubview:[KBBox horizontalLine]];
  YOView *footerView = [YOView view];
  NSImage *backImage = [NSImage imageNamed:@"46-Arrows-black-arrow-67-24"];
  backImage.size = CGSizeMake(12, 12);
  _editButton = [KBButton buttonWithText:@"Edit" image:backImage style:KBButtonStyleDefault];
  [footerView addSubview:_editButton];
  _shareButton = [KBButton buttonWithText:@"Share" style:KBButtonStyleDefault];
  [footerView addSubview:_shareButton];

  _closeButton = [KBButton buttonWithText:@"Done" style:KBButtonStyleDefault];
  [footerView addSubview:_closeButton];

  YOSelf yself = self;
  footerView.viewLayout = [YOLayout layoutWithLayoutBlock:^CGSize(id<YOLayout> layout, CGSize size) {
    CGFloat y = 20;
    CGSize buttonSize = [yself.closeButton sizeThatFits:size];
    [layout setFrame:CGRectMake(size.width - buttonSize.width - 20, y, buttonSize.width, buttonSize.height) view:yself.closeButton];

    CGFloat x = 20;
    x += [layout sizeToFitHorizontalInFrame:CGRectMake(x, y, 0, buttonSize.height) view:yself.editButton].size.width + 20;
    x += [layout sizeToFitHorizontalInFrame:CGRectMake(x, y, 0, buttonSize.height) view:yself.shareButton].size.width + 20;
    y += buttonSize.height + 20;
    return CGSizeMake(size.width, y);
  }];
  [self addSubview:footerView];
}

@end
