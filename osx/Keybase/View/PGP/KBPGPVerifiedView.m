//
//  KBPGPVerifiedView.m
//  Keybase
//
//  Created by Gabriel on 4/24/15.
//  Copyright (c) 2015 Gabriel Handford. All rights reserved.
//

#import "KBPGPVerifiedView.h"

#import "AppDelegate.h"
#import "KBUserView.h"

@interface KBPGPVerifiedView ()
@property KBUserView *userView;
@end

@implementation KBPGPVerifiedView

- (void)viewInit {
  [super viewInit];

  KBBox *line = [KBBox horizontalLine];
  [self addSubview:line];

  _userView = [[KBUserView alloc] init];
  _userView.border.position = KBBoxPositionTop;
  [self addSubview:_userView];

  YOSelf yself = self;
  self.viewLayout = [YOLayout layoutWithLayoutBlock:^(id<YOLayout> layout, CGSize size) {
    if (!yself.pgpSigVerification) return CGSizeMake(size.width, 0);

    [layout setFrame:CGRectMake(0, 0, size.width, 1) view:line];
    CGFloat x = 0;
    CGFloat y = 0;
    y += [layout sizeToFitVerticalInFrame:CGRectMake(x, y, size.width - x, 0) view:yself.userView].size.height;

    return CGSizeMake(size.width, y);
  }];
}

- (void)setPgpSigVerification:(KBRPgpSigVerification *)pgpSigVerification {
  _pgpSigVerification = pgpSigVerification;

  KBRUser *signer = _pgpSigVerification.signer;

  if (signer) {
    [self kb_setBackgroundColor:[NSColor colorWithRed:230.0/255.0 green:1.0 blue:190.0/255.0 alpha:1.0]];

    [_userView setUser:signer];
  } else {
    [self kb_setBackgroundColor:NSColor.whiteColor];
    [_userView setUser:nil];
  }

  [self setNeedsLayout];
}


@end
