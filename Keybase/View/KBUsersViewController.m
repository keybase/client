//
//  KBUsersViewController.m
//  Keybase
//
//  Created by Gabriel on 1/8/15.
//  Copyright (c) 2015 Gabriel Handford. All rights reserved.
//

#import "KBUsersViewController.h"
#import "KBUserView.h"

@implementation KBUsersViewController

- (void)windowDidLoad {
  self.window.backgroundColor = NSColor.whiteColor;

  KBUserView *userView = [[KBUserView alloc] initWithFrame:NSMakeRect(0, 0, 320, 0)];
  KBUser *user = [MTLJSONAdapter modelOfClass:KBUser.class fromJSONDictionary:@{
                                                                                @"basics": @{@"username": @"gabrielh"},
                                                                                @"profile": @{@"bio": @"I am a leaf in the wind, watch how I soar."},
                                                                                @"pictures": @{@"primary": @{@"url": @"https://s3.amazonaws.com/keybase_processed_uploads/8e6bc7c985b0f099c2263edf0cd49b05_200_200_square_200.jpeg"}},
                                                                                } error:nil];
  [userView setUser:user];
  [userView sizeToFit];
  self.window.title = @"Keybase";
  [self.window.contentView addSubview:userView];
  [self.window setContentSize:userView.frame.size];
}

@end
