//
//  KBProofView.m
//  Keybase
//
//  Created by Gabriel on 6/24/15.
//  Copyright (c) 2017 Keybase. All rights reserved.
//

#import "KBProofView.h"


#import "KBWorkspace.h"
#import <GHKit/GHKit.h>

@interface KBProofView ()
//@property KBWebView *webView;
@property KBButton *link;
@end

@implementation KBProofView

- (void)viewInit {
  [super viewInit];
  [self kb_setBackgroundColor:KBAppearance.currentAppearance.backgroundColor];

  GHWeakSelf gself = self;
  //_webView = [[KBWebView alloc] init];
  //[self addSubview:_webView];

  YOVBox *contentView = [YOVBox box:@{@"insets": @(40), @"spacing": @(20)}];
  {
    YOVBox *openView = [YOVBox box:@{@"spacing": @(10)}];
    {
      _link = [KBButton button];
      _link.targetBlock = ^{ gself.completion(gself, KBProofActionOpen); };
      [openView addSubview:_link];
    }
    [contentView addSubview:openView];

    YOHBox *buttonsView = [YOHBox box:@{@"spacing": @(10), @"horizontalAlignment": @"center"}];
    {
      KBButton *replaceButton = [KBButton buttonWithText:@"Replace" style:KBButtonStyleDefault options:KBButtonOptionsToolbar];
      replaceButton.targetBlock = ^{ self.completion(gself, KBProofActionReplace); };
      [buttonsView addSubview:replaceButton];

      KBButton *revokeButton = [KBButton buttonWithText:@"Revoke" style:KBButtonStyleDanger options:KBButtonOptionsToolbar];
      revokeButton.targetBlock = ^{ self.completion(gself, KBProofActionRevoke); };
      [buttonsView addSubview:revokeButton];
    }
    [contentView addSubview:buttonsView];
  }
  [self addSubview:contentView];

  YOVBox *bottomView = [YOVBox box];
  [bottomView kb_setBackgroundColor:KBAppearance.currentAppearance.secondaryBackgroundColor];
  {
    [bottomView addSubview:[KBBox horizontalLine]];
    YOHBox *rightButtons = [YOHBox box:@{@"spacing": @(10), @"insets": @"10,20,10,20", @"horizontalAlignment": @"right", @"minSize": @"90,0"}];
    {
      KBButton *cancelButton = [KBButton buttonWithText:@"Close" style:KBButtonStyleDefault options:KBButtonOptionsToolbar];
      cancelButton.targetBlock = ^{ gself.completion(gself, KBProofActionCancel); };
      [rightButtons addSubview:cancelButton];
    }
    [bottomView addSubview:rightButtons];
  }
  [self addSubview:bottomView];

  self.viewLayout = [YOVBorderLayout layoutWithCenter:contentView top:nil bottom:@[bottomView]];
}

- (void)setProofResult:(KBProofResult *)proofResult {
  _proofResult = proofResult;
  //[_webView openURLString:proofResult.result.hint.humanUrl];
  [_link setText:proofResult.result.hint.humanUrl style:KBButtonStyleLink options:0];
  [self setNeedsLayout];
}

@end
