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

KBRTrackProof *KBFindProof(KBRProofs *proofs, NSString *proofType) {
  for (KBRTrackProof *proof in proofs.social) {
    if ([proof.proofType isEqualToString:proofType]) return proof;
  }
  return nil;
}

- (void)setUserSummary:(KBRUserSummary *)userSummary {
  self.imageSize = CGSizeMake(40, 40);
  [self.titleLabel setText:userSummary.username font:KBAppearance.currentAppearance.boldLargeTextFont color:[KBAppearance.currentAppearance textColor] alignment:NSLeftTextAlignment];

  KBRTrackProof *proof = KBFindProof(userSummary.proofs, @"twitter");

  if (proof) {
    [self.infoLabel setText:NSStringWithFormat(@"%@@twitter", proof.proofName) style:KBLabelStyleDefault];
  } else {
    self.infoLabel.attributedText = nil;
  }
  ((KBUserImageView *)self.imageView).username = userSummary.username;
}

@end
