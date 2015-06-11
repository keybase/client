//
//  KBPGPDecryptFooterView.m
//  Keybase
//
//  Created by Gabriel on 3/27/15.
//  Copyright (c) 2015 Gabriel Handford. All rights reserved.
//

#import "KBPGPDecryptFooterView.h"

@implementation KBPGPDecryptFooterView

- (void)viewInit {
  [super viewInit];
  [self kb_setBackgroundColor:KBAppearance.currentAppearance.secondaryBackgroundColor];

  [self addSubview:[KBBox horizontalLine]];

  YOView *buttonsView = [YOView view];
  _decryptButton = [KBButton buttonWithText:@"Decrypt" style:KBButtonStylePrimary];
  [buttonsView addSubview:_decryptButton];
  YOSelf yself = self;
  buttonsView.viewLayout = [YOLayout layoutWithLayoutBlock:^CGSize(id<YOLayout> layout, CGSize size) {
    CGFloat y = 20;
    CGSize buttonSize = [yself.decryptButton sizeThatFits:size];
    [layout setFrame:CGRectMake(size.width - buttonSize.width - 20, y, buttonSize.width, buttonSize.height) view:yself.decryptButton];
    y += buttonSize.height + 20;
    return CGSizeMake(size.width, y);
  }];
  [self addSubview:buttonsView];
}

@end
