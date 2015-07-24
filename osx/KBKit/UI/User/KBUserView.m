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

- (void)viewInit {
  [super viewInit];
  self.imageView.roundedRatio = 1.0;
}

- (void)setUser:(KBRUser *)user {
  self.imageSize = CGSizeMake(40, 40);
  [self.titleLabel setText:user.username style:KBTextStyleDefault options:KBTextOptionsStrong alignment:NSLeftTextAlignment lineBreakMode:NSLineBreakByClipping];
  self.infoLabel.attributedText = nil;
  [self.imageView kb_setUsername:user.username];
  [self setNeedsLayout];
}

- (void)setUserSummary:(KBRUserSummary *)userSummary {
  self.imageSize = CGSizeMake(40, 40);
  [self.titleLabel setText:userSummary.username style:KBTextStyleDefault options:KBTextOptionsStrong alignment:NSLeftTextAlignment lineBreakMode:NSLineBreakByClipping];
  self.infoLabel.attributedText = [self attributedStringForUserSummary:userSummary appearance:KBAppearance.currentAppearance];
  [self.imageView kb_setUsername:userSummary.username];
  [self setNeedsLayout];
}

- (NSAttributedString *)attributedStringForProof:(KBRTrackProof *)proof appearance:(id<KBAppearance>)appearance attributes:(NSDictionary *)attributes {
  // TODO If no icon, we should show proof.idString as text?
  return [KBFontIcon attributedStringForIcon:proof.proofType text:proof.proofName appearance:appearance style:KBTextStyleSecondaryText options:KBTextOptionsSmall alignment:NSLeftTextAlignment lineBreakMode:NSLineBreakByClipping sender:self];
}

- (NSMutableAttributedString *)attributedStringForUserSummary:(KBRUserSummary *)userSummary appearance:(id<KBAppearance>)appearance {
  NSMutableArray *strings = [NSMutableArray array];
  NSMutableParagraphStyle *paragraphStyle = [[NSMutableParagraphStyle alloc] init];
  paragraphStyle.alignment = NSLeftTextAlignment;
  paragraphStyle.lineBreakMode = NSLineBreakByClipping;
  NSDictionary *attributes = @{NSFontAttributeName: appearance.textFont, NSParagraphStyleAttributeName: paragraphStyle};
  if (userSummary.fullName) {
    [strings addObject:[[NSAttributedString alloc] initWithString:userSummary.fullName attributes:attributes]];
  }

  for (KBRTrackProof *proof in userSummary.proofs.social) {
    NSAttributedString *proofText = [self attributedStringForProof:proof appearance:appearance attributes:attributes];
    if (proofText) [strings addObject:proofText];
  }

  if ([strings count] == 0) return nil;
  return [KBText join:strings delimeter:[[NSAttributedString alloc] initWithString:@"  " attributes:attributes]];
}

@end


@implementation KBUserCell

- (void)viewInit {
  [super viewInit];
  self.border.position = KBBoxPositionBottom;
}

@end