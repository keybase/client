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

- (void)setUsers:(NSArray *)users {
  [self setObjects:users];
}

- (void)updateView:(KBUserView *)view object:(KBRUser *)object {
  [view setUser:object];
}

- (void)select:(KBRUser *)user {
  [self.delegate usersView:self didSelectUser:user];
}

@end
