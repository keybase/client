//
//  KBUserProfileViewController.m
//  Keybase
//
//  Created by Gabriel on 1/9/15.
//  Copyright (c) 2015 Gabriel Handford. All rights reserved.
//

#import "KBUserProfileViewController.h"
#import "KBUserProfileView.h"
#import "AppDelegate.h"

@implementation KBUserProfileViewController

- (void)windowDidLoad {
  self.window.title = @"";
  self.window.backgroundColor = NSColor.whiteColor;
}

- (void)loadUsername:(NSString *)username {
  [AppDelegate.APIClient userForKey:@"usernames" value:username fields:nil success:^(KBUser *user) {
    [self setUser:user];
  } failure:^(NSError *error) {

  }];
}

- (void)setUser:(KBUser *)user {
  KBUserProfileView *view = [[KBUserProfileView alloc] initWithFrame:NSMakeRect(0, 0, 320, 480)];
  [view setUser:user];
  [self.window.contentView addSubview:view];

  [self.window setContentSize:CGSizeMake(320, 480)];
}

@end
