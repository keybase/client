//
//  KBPGPVerifiedView.m
//  Keybase
//
//  Created by Gabriel on 4/24/15.
//  Copyright (c) 2015 Gabriel Handford. All rights reserved.
//

#import "KBPGPVerifiedView.h"

#import "KBUserView.h"

@interface KBPGPVerifiedView ()
@property KBLabel *label;
@property KBUserView *userView;
@end

@implementation KBPGPVerifiedView

- (void)viewInit {
  [super viewInit];

  [self addSubview:[KBBox horizontalLine]];

  YOVBox *contentView = [YOVBox box:@{@"insets": @"8,10,8,10", @"spacing": @(8)}];
  contentView.ignoreLayoutForHidden = YES;
  [self addSubview:contentView];

  _label = [[KBLabel alloc] init];
  [contentView addSubview:_label];

  _userView = [[KBUserView alloc] init];
  _userView.insets = UIEdgeInsetsZero;
  [contentView addSubview:_userView];

  YOSelf yself = self;
  self.viewLayout = [YOLayout layoutWithLayoutBlock:^CGSize(id<YOLayout> layout, CGSize size) {
    if (!yself.pgpSigVerification) return CGSizeMake(size.width, 0);
    return YOLayoutVertical(self, layout, size);
  }];
}

- (void)setPgpSigVerification:(KBRPGPSigVerification *)pgpSigVerification {
  _pgpSigVerification = pgpSigVerification;
  [_userView setUser:nil];
  _userView.hidden = YES;
  _label.attributedText = nil;

  if (_pgpSigVerification.isSigned) {
    if (_pgpSigVerification.verified) {
      [self kb_setBackgroundColor:KBAppearance.currentAppearance.successBackgroundColor];
      [_label setText:@"Signed and verified." style:KBTextStyleDefault];
      [_userView setUser:_pgpSigVerification.signer];
      _userView.hidden = NO;
    } else {
      [self kb_setBackgroundColor:KBAppearance.currentAppearance.backgroundColor];
      [_label setText:@"Signed but not verified." style:KBTextStyleDefault];
    }
  } else {
    [self kb_setBackgroundColor:KBAppearance.currentAppearance.warnBackgroundColor];
    [_label setText:@"Not signed." style:KBTextStyleDefault];
  }

  [self setNeedsLayout];
}


@end
