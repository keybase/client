//
//  KBUserView.m
//  Keybase
//
//  Created by Gabriel on 1/7/15.
//  Copyright (c) 2015 Gabriel Handford. All rights reserved.
//

#import "KBUserView.h"

@implementation KBUserView

- (void)setUser:(KBRUser *)user {
  [self.titleLabel setText:user.username font:[NSFont boldSystemFontOfSize:16] color:[KBAppearance.currentAppearance textColor] alignment:NSLeftTextAlignment];
  self.imageView.URLString = user.image.url;
  [self setNeedsLayout];
}

@end
