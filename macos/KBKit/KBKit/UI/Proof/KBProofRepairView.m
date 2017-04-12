//
//  KBProofRepairView.m
//  Keybase
//
//  Created by Gabriel on 6/24/15.
//  Copyright (c) 2015 Keybase. All rights reserved.
//

#import "KBProofRepairView.h"

#import "KBDefines.h"
#import "KBWorkspace.h"
#import <GHKit/GHKit.h>

@interface KBProofRepairView ()
@end

@implementation KBProofRepairView

- (void)viewInit {
  [super viewInit];
  [self kb_setBackgroundColor:KBAppearance.currentAppearance.backgroundColor];

  GHWeakSelf gself = self;

  YOVBox *contentView = [YOVBox box:@{@"spacing": @(20), @"insets": @(20)}];
  {
    [contentView addSubview:[KBLabel labelWithText:@"Your proof has failed, and Keybase has stopped checking it. How should we proceed?" style:KBTextStyleDefault]];

    YOHBox *buttons = [YOHBox box:@{@"spacing": @(10), @"horizontalAlignment": @"center", @"minSize": @"120,0"}];
    {
      KBButton *retryButton = [KBButton buttonWithText:@"Retry" style:KBButtonStyleDefault options:KBButtonOptionsToolbar];
      retryButton.targetBlock = ^{ self.completion(gself, KBProofActionRetry); };
      [buttons addSubview:retryButton];

      KBButton *replaceButton = [KBButton buttonWithText:@"Replace" style:KBButtonStyleDefault options:KBButtonOptionsToolbar];
      replaceButton.targetBlock = ^{ self.completion(gself, KBProofActionReplace); };
      [buttons addSubview:replaceButton];

      KBButton *revokeButton = [KBButton buttonWithText:@"Abandon" style:KBButtonStyleDefault options:KBButtonOptionsToolbar];
      revokeButton.targetBlock = ^{ self.completion(gself, KBProofActionReplace); };
      [buttons addSubview:revokeButton];
    }
    [contentView addSubview:buttons];
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
  [self setNeedsLayout];
}

@end

