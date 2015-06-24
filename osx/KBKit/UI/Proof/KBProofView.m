//
//  KBProofView.m
//  Keybase
//
//  Created by Gabriel on 6/24/15.
//  Copyright (c) 2015 Keybase. All rights reserved.
//

#import "KBProofView.h"

#import "KBProveType.h"
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
    _link.targetBlock = ^{ gself.completion(gself, KBProofViewActionOpen); };
    [linkView addSubview:_link];
  }
  [self addSubview:linkView];

  YOVBox *bottomView = [YOVBox box];
  [bottomView kb_setBackgroundColor:KBAppearance.currentAppearance.secondaryBackgroundColor];
  {
    [bottomView addSubview:[KBBox horizontalLine]];

    YOHBox *buttons = [YOHBox box:@{@"spacing": @(10), @"insets": @(20)}];
    {
      KBButton *replaceButton = [KBButton buttonWithText:@"Replace" style:KBButtonStyleDefault options:KBButtonOptionsToolbar];
      replaceButton.targetBlock = ^{ self.completion(gself, KBProofViewActionWantsReplace); };
      [buttons addSubview:replaceButton];

      KBButton *revokeButton = [KBButton buttonWithText:@"Revoke" style:KBButtonStyleDanger options:KBButtonOptionsToolbar];
      revokeButton.targetBlock = ^{ [gself revoke]; };
      [buttons addSubview:revokeButton];

      YOHBox *rightButtons = [YOHBox box:@{@"spacing": @(10), @"horizontalAlignment": @"right", @"minSize": @"90,0"}];
      {
        KBButton *cancelButton = [KBButton buttonWithText:@"Close" style:KBButtonStyleDefault options:KBButtonOptionsToolbar];
        cancelButton.targetBlock = ^{ gself.completion(gself, KBProofViewActionClose); };
        [rightButtons addSubview:cancelButton];
      }
      [buttons addSubview:rightButtons];
    }
    [bottomView addSubview:buttons];
  }
  [self addSubview:bottomView];
}

- (void)setProofResult:(KBProofResult *)proofResult {
  _proofResult = proofResult;
  //[_webView openURLString:proofResult.result.hint.humanUrl];
  [_link setText:proofResult.result.hint.humanUrl style:KBButtonStyleLink options:0];
  [self setNeedsLayout];
}

- (void)revoke {
  [KBAlert yesNoWithTitle:@"Quit" description:@"Are you sure you want to revoke this proof?" yes:@"Revoke" view:self completion:^(BOOL yes) {
    if (yes) [self _revoke];
  }];
}

- (void)_revoke {
  NSAssert(_proofResult.proof.sigID, @"No proof sigId");
  GHWeakSelf gself = self;
  [KBActivity setProgressEnabled:YES sender:self];
  KBRRevokeRequest *request = [[KBRRevokeRequest alloc] initWithClient:self.client];
  [request revokeSigsWithSessionID:request.sessionId ids:@[_proofResult.proof.sigID] seqnos:nil completion:^(NSError *error) {
    [KBActivity setProgressEnabled:NO sender:self];
    if ([KBActivity setError:error sender:self]) return;
    gself.completion(self, KBProofViewActionRevoked);
  }];
}

@end
