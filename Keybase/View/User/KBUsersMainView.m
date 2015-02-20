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
#import "KBProgressOverlayView.h"

@interface KBUsersMainView ()
@property NSSearchField *searchField;
@property KBUsersView *usersView;
@property KBBox *border;
@property KBUserProfileView *userProfileView;

@property KBProgressOverlayView *progressView;
@end

@implementation KBUsersMainView

- (void)viewInit {
  [super viewInit];

  _searchField = [[NSSearchField alloc] init];
  _searchField.delegate = self;
  _searchField.placeholderString = @"Search";
  [_searchField.cell setMaximumRecents:20];
  [self addSubview:_searchField];

  _usersView = [[KBUsersView alloc] init];
  _usersView.delegate = self;
  [self addSubview:_usersView];

  _border = [KBBox lineWithWidth:1.0 color:[KBAppearance.currentAppearance lineColor]];
  [self addSubview:_border];

  _userProfileView = [[KBUserProfileView alloc] init];
  [self addSubview:_userProfileView];

  _progressView = [[KBProgressOverlayView alloc] init];
  [self addSubview:_progressView];

  YOSelf yself = self;
  self.viewLayout = [YOLayout layoutWithLayoutBlock:^(id<YOLayout> layout, CGSize size) {

    CGFloat col1 = 200;
    CGFloat col1y = 10;
    col1y += [layout setFrame:CGRectMake(10, col1y, col1 - 21, 22) view:yself.searchField].size.height + 10;
    [layout setFrame:CGRectMake(0, col1y, col1 - 1, size.height - col1y) view:yself.usersView];

    [layout setFrame:CGRectMake(col1 - 1, 0, 1, size.height) view:yself.border];
    [layout setFrame:CGRectMake(col1, 0, size.width - col1, size.height) view:yself.userProfileView];
    [layout setSize:size view:yself.progressView options:0];
    return size;
  }];
}

- (void)controlTextDidChange:(NSNotification *)notification {

}

- (void)usersView:(KBUsersView *)usersView didSelectUser:(KBRUser *)user {
  [_userProfileView setUser:user editable:NO];
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
    usernames = @[@"chris", @"max", @"gabrielh", @"patrick"]; //, @"oconnor663", @"jbyers", @"twk", @"barmstrong", @"jbyers"];
  }
  GHWeakSelf gself = self;
  _progressView.animating = YES;
  [self loadUsernames:usernames completion:^(NSError *error, NSArray *users) {
    gself.progressView.animating = NO;
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
