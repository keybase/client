//
//  KBUserView.m
//  Keybase
//
//  Created by Gabriel on 1/7/15.
//  Copyright (c) 2015 Gabriel Handford. All rights reserved.
//

#import "KBUserView.h"

#import "KBUserImageView.h"

@implementation KBUserView

- (KBImageView *)loadImageView {
  return [[KBUserImageView alloc] init];
}

- (void)setUser:(KBRUser *)user {
  self.imageSize = CGSizeMake(40, 40);
  [self.titleLabel setText:user.username font:KBAppearance.currentAppearance.boldLargeTextFont color:[KBAppearance.currentAppearance textColor] alignment:NSLeftTextAlignment];
  ((KBUserImageView *)self.imageView).username = user.username;
}

- (void)setUserSummary:(KBRUserSummary *)userSummary {
  self.imageSize = CGSizeMake(40, 40);
  [self.titleLabel setText:userSummary.username font:KBAppearance.currentAppearance.boldLargeTextFont color:[KBAppearance.currentAppearance textColor] alignment:NSLeftTextAlignment];
  if (userSummary.proofs.twitter) {
    [self.infoLabel setText:NSStringWithFormat(@"%@@twitter", userSummary.proofs.twitter) style:KBLabelStyleDefault];
  } else {
    self.infoLabel.attributedText = nil;
  }
  ((KBUserImageView *)self.imageView).username = userSummary.username;
}

@end
