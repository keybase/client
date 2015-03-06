//
//  KBTrackEntryView.m
//  Keybase
//
//  Created by Gabriel on 3/6/15.
//  Copyright (c) 2015 Gabriel Handford. All rights reserved.
//

#import "KBTrackEntryView.h"

#import "KBUserImageView.h"


@implementation KBTrackEntryView

- (KBImageView *)loadImageView {
  return [[KBUserImageView alloc] init];
}

- (void)setTrackEntry:(KBRTrackEntry *)trackEntry {
  self.imageSize = CGSizeMake(40, 40);
  [self.titleLabel setText:trackEntry.username font:[NSFont boldSystemFontOfSize:16] color:[KBAppearance.currentAppearance textColor] alignment:NSLeftTextAlignment];
  [self.infoLabel setText:@"" style:KBLabelStyleDefault appearance:KBAppearance.currentAppearance alignment:NSLeftTextAlignment lineBreakMode:NSLineBreakByTruncatingTail];
  ((KBUserImageView *)self.imageView).username = trackEntry.username;
  [self setNeedsLayout];
}

@end
