//
//  KBUserImageView.m
//  Keybase
//
//  Created by Gabriel on 3/6/15.
//  Copyright (c) 2015 Gabriel Handford. All rights reserved.
//

#import "KBUserImageView.h"

#import "AppDelegate.h"

@implementation KBUserImageView

- (void)viewInit {
  [super viewInit];
  self.roundedRatio = 1.0;
}

- (void)setUsername:(NSString *)username {
  _username = username;
  NSString *URLString = [AppDelegate.sharedDelegate.APIClient URLStringWithPath:NSStringWithFormat(@"%@/picture?format=square_200", username)];
  [self setURLString:URLString defaultURLString:@"https://keybase.io/images/no_photo.png"];
}

@end
