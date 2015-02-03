//
//  KBUsersView.m
//  Keybase
//
//  Created by Gabriel on 1/8/15.
//  Copyright (c) 2015 Gabriel Handford. All rights reserved.
//

#import "KBUsersView.h"

#import "KBUserView.h"
#import "AppDelegate.h"
#import "KBUserProfileView.h"
#import "KBTableRowView.h"

@interface KBUsersView ()
@end


@implementation KBUsersView

- (void)viewInit {
  [super viewInit];
  self.prototypeClass = KBUserView.class;
}

- (void)loadUsernames:(NSArray *)usernames {
  //self.progressIndicatorEnabled = YES;
  [AppDelegate.APIClient usersForKey:@"usernames" value:[usernames join:@","] fields:nil success:^(NSArray *users) {
    //self.progressIndicatorEnabled = NO;
    [self setUsers:users];
  } failure:^(NSError *error) { }];
}

- (void)setUsers:(NSArray *)users {
  [self setObjects:users];
}

- (void)updateView:(KBUserView *)view object:(KBUser *)object {
  [view setUser:object];
}

- (void)select:(KBUser *)user {
  KBUserProfileView *userProfileView = [[KBUserProfileView alloc] init];
  KBRUser *ruser = [[KBRUser alloc] initWithDictionary:@{@"uid": [user.identifier na_dataFromHexString], @"username": user.userName} error:nil];
  [self.navigation pushView:userProfileView animated:YES];
  [userProfileView setUser:ruser track:YES];
}

@end
