//
//  KBUsersMainView.m
//  Keybase
//
//  Created by Gabriel on 2/6/15.
//  Copyright (c) 2015 Gabriel Handford. All rights reserved.
//

#import "KBUsersMainView.h"

#import "KBUserProfileView.h"
#import "AppDelegate.h"

@interface KBUsersMainView ()
@property KBUsersView *usersView;
@property KBBox *border;
@property KBUserProfileView *userProfileView;
@end

@implementation KBUsersMainView

- (void)viewInit {
  [super viewInit];

  _usersView = [[KBUsersView alloc] init];
  _usersView.delegate = self;
  [self addSubview:_usersView];

  _border = [KBBox lineWithWidth:1.0 color:[KBLookAndFeel lineColor]];
  [self addSubview:_border];

  _userProfileView = [[KBUserProfileView alloc] init];
  [self addSubview:_userProfileView];

  YOSelf yself = self;
  self.viewLayout = [YOLayout layoutWithLayoutBlock:^(id<YOLayout> layout, CGSize size) {
    CGFloat col1 = 200;
    [layout setFrame:CGRectMake(0, 0, col1 - 1, size.height) view:yself.usersView];
    [layout setFrame:CGRectMake(col1 - 1, 0, 1, size.height) view:yself.border];
    [layout setFrame:CGRectMake(col1, 0, size.width - col1, size.height) view:yself.userProfileView];
    return size;
  }];
}

- (void)usersView:(KBUsersView *)usersView didSelectUser:(KBRUser *)user {
  [_userProfileView setUser:user track:YES];
}

- (void)setUser:(KBRUser *)user {
  [_usersView setUsers:nil];
  [_userProfileView clear];

  // Mock data
  NSArray *usernames;
  if ([user.username isEqualTo:@"gabrielh"]) {
    usernames = @[@"chris", @"max"];
  } else if ([user.username isEqualTo:@"chris"]) {
    usernames = @[@"max", @"barmstrong", @"twk", @"patrick"];
  } else if ([user.username isEqualTo:@"max"]) {
    usernames = @[@"chris", @"samyagan", @"oconnor663", @"jbyers"];
  } else {
    usernames = @[@"chris", @"max", @"gabrielh"];
  }
  GHWeakSelf gself = self;
  [self loadUsernames:usernames completion:^(NSError *error, NSArray *users) {
    [gself.usersView setUsers:users];
  }];
}

- (void)loadUsernames:(NSArray *)usernames completion:(void (^)(NSError *error, NSArray *users))completion {
  //self.progressIndicatorEnabled = YES;
  [AppDelegate.APIClient usersForKey:@"usernames" value:[usernames join:@","] fields:nil success:^(NSArray *users) {
    //self.progressIndicatorEnabled = NO;
    completion(nil, KBRUsersForUsers(users));
  } failure:^(NSError *error) {
    completion(error, nil);
  }];
}

// For mocking from API
NSArray *KBRUsersForUsers(NSArray *APIUsers) {
  return [APIUsers map:^id(KBUser *APIUser) {
    KBRUser *user = [[KBRUser alloc] init];
    user.uid = (KBRUID *)[APIUser.identifier na_dataFromHexString];
    user.username = APIUser.userName;
    user.image = [[KBRImage alloc] init];
    user.image.url = APIUser.image.URLString;
    user.image.width = APIUser.image.width;
    user.image.height = APIUser.image.height;
    return user;
  }];
}

@end
