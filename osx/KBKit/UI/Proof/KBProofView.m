//
//  KBProofView.m
//  Keybase
//
//  Created by Gabriel on 6/24/15.
//  Copyright (c) 2015 Keybase. All rights reserved.
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

  YOVBox *linkView = [YOVBox box:@{@"insets": @(40)}];
  {
    _link = [KBButton button];
    _link.targetBlock = ^{ gself.completion(gself, KBProofActionOpen); };
    [linkView addSubview:_link];
  }
  [self addSubview:linkView];

  YOVBox *bottomView = [YOVBox box];
  [bottomView kb_setBackgroundColor:KBAppearance.currentAppearance.secondaryBackgroundColor];
  {
    [bottomView addSubview:[KBBox horizontalLine]];

    YOHBox *buttons = [YOHBox box:@{@"spacing": @(10), @"insets": @"10,20,10,20"}];
    {
      KBButton *replaceButton = [KBButton buttonWithText:@"Replace" style:KBButtonStyleDefault options:KBButtonOptionsToolbar];
      replaceButton.targetBlock = ^{ self.completion(gself, KBProofActionReplace); };
      [buttons addSubview:replaceButton];

      KBButton *revokeButton = [KBButton buttonWithText:@"Revoke" style:KBButtonStyleDanger options:KBButtonOptionsToolbar];
      revokeButton.targetBlock = ^{ self.completion(gself, KBProofActionRevoke); };
      [buttons addSubview:revokeButton];

      YOHBox *rightButtons = [YOHBox box:@{@"spacing": @(10), @"horizontalAlignment": @"right", @"minSize": @"90,0"}];
      {
        KBButton *cancelButton = [KBButton buttonWithText:@"Close" style:KBButtonStyleDefault options:KBButtonOptionsToolbar];
        cancelButton.targetBlock = ^{ gself.completion(gself, KBProofActionCancel); };
        [rightButtons addSubview:cancelButton];
      }
      [buttons addSubview:rightButtons];
    }
    [bottomView addSubview:buttons];
  }
  [self addSubview:bottomView];

  self.viewLayout = [YOBorderLayout layoutWithCenter:linkView top:nil bottom:@[bottomView]];
}

- (void)setProofResult:(KBProofResult *)proofResult {
  _proofResult = proofResult;
  //[_webView openURLString:proofResult.result.hint.humanUrl];
  [_link setText:proofResult.result.hint.humanUrl style:KBButtonStyleLink options:0];
  [self setNeedsLayout];
}

@end
