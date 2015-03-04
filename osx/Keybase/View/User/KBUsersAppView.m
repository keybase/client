//
//  KBUsersAppView.m
//  Keybase
//
//  Created by Gabriel on 2/6/15.
//  Copyright (c) 2015 Gabriel Handford. All rights reserved.
//

#import "KBUsersAppView.h"

#import "KBUserProfileView.h"
#import "AppDelegate.h"
#import "KBProgressOverlayView.h"
#import "KBUserView.h"
#import "KBSearchResultView.h"
#import "KBSearchControl.h"

@interface KBUsersAppView ()
@property KBSearchControl *searchField;
@property KBListView *usersView;
@property KBListView *searchResultsView;
@property KBUserProfileView *userProfileView;

@property KBActivityIndicatorView *progressView;
@property NSString *searchText;
@end

@implementation KBUsersAppView

- (void)viewInit {
  [super viewInit];

  YOSelf yself = self;

  _searchField = [[KBSearchControl alloc] init];
  _searchField.delegate = self;
  [self addSubview:_searchField];

  _usersView = [KBListView listViewWithPrototypeClass:KBUserView.class rowHeight:56];
  _usersView.hidden = YES;
  _usersView.cellSetBlock = ^(KBUserView *view, KBRUser *user, NSIndexPath *indexPath, id containingView, BOOL dequeued) {
    [view setUser:user];
  };
  _usersView.selectBlock = ^(id sender, NSIndexPath *indexPath, KBRUser *user) {
    [yself selectUser:user];
  };
  [self addSubview:_usersView];

  _searchResultsView = [KBListView listViewWithPrototypeClass:KBSearchResultView.class rowHeight:56];
  _searchResultsView.cellSetBlock = ^(KBSearchResultView *view, KBSearchResult *searchResult, NSIndexPath *indexPath, id containingView, BOOL dequeued) {
    [view setSearchResult:searchResult];
  };
  _searchResultsView.selectBlock = ^(id sender, NSIndexPath *indexPath, KBSearchResult *searchResult) {
    [yself selectUser:KBRUserFromSearchResult(searchResult)];
  };
  [self addSubview:_searchResultsView];

  _userProfileView = [[KBUserProfileView alloc] init];
  [self addSubview:_userProfileView];

  _progressView = [[KBActivityIndicatorView alloc] init];
  _progressView.lineWidth = 1.0;
  [self addSubview:_progressView];

  KBBox *borderLeftTop = [KBBox lineWithWidth:1.0 color:KBAppearance.currentAppearance.lineColor];
  [self addSubview:borderLeftTop];
  KBBox *borderMiddle = [KBBox lineWithWidth:1.0 color:[KBAppearance.currentAppearance lineColor]];
  [self addSubview:borderMiddle];

  self.viewLayout = [YOLayout layoutWithLayoutBlock:^(id<YOLayout> layout, CGSize size) {

    CGFloat col1 = 240;
    // If this y is too small, the search field focus will conflict with the window title bar drag
    // and the search field will become really janky.
    CGFloat col1y = 24;

    [layout setFrame:CGRectMake(col1 - 46, col1y + 4, 14, 14) view:yself.progressView];

    col1y += [layout setFrame:CGRectMake(10, col1y, col1 - 21, 22) view:yself.searchField].size.height + 9;

    [layout setFrame:CGRectMake(0, col1y - 1, col1, 1) view:borderLeftTop];

    [layout setFrame:CGRectMake(0, col1y, col1 - 1, size.height - col1y) view:yself.usersView];
    [layout setFrame:CGRectMake(0, col1y, col1 - 1, size.height - col1y) view:yself.searchResultsView];

    //[layout setFrame:CGRectMake(col1/2.0 - 16, col1y + 20, 32, 32) view:yself.progressView];

    [layout setFrame:CGRectMake(col1 - 1, 0, 1, size.height) view:borderMiddle];
    [layout setFrame:CGRectMake(col1, 0, size.width - col1, size.height) view:yself.userProfileView];

    return size;
  }];
}

- (void)setUser:(KBRUser *)user {
  [_usersView removeAllObjects];
  [_userProfileView clear];
  [self selectUser:user];
}

- (void)selectUser:(KBRUser *)user {
  BOOL editable = [AppDelegate.appView.user.username isEqual:user.username];
  [_userProfileView setUser:user editable:editable client:AppDelegate.client];
}

- (void)loadUsernames:(NSArray *)usernames completion:(void (^)(NSError *error, NSArray *users))completion {
  //self.progressIndicatorEnabled = YES;
  [AppDelegate.APIClient usersForKey:@"usernames" value:[usernames join:@","] fields:nil success:^(NSArray *users) {
    //self.progressIndicatorEnabled = NO;
    completion(nil, KBRUsersFromAPIUsers(users));
  } failure:^(NSError *error) {
    completion(error, nil);
  }];
}

NSArray *KBRUsersFromAPIUsers(NSArray *APIUsers) {
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

KBRUser *KBRUserFromSearchResult(KBSearchResult *searchResult) {
  KBRUser *user = [[KBRUser alloc] init];
  user.uid = (KBRUID *)[searchResult.userId na_dataFromHexString];
  user.username = searchResult.userName;
  user.image = [[KBRImage alloc] init];
  user.image.url = searchResult.thumbnailURLString;
  return user;
}

#pragma mark Search

- (void)searchControl:(KBSearchControl *)searchControl shouldDisplaySearchResults:(NSArray *)searchResults {
  [_searchResultsView setObjects:searchResults];
}

- (void)searchControlShouldClearSearchResults:(KBSearchControl *)searchControl {
  [_searchResultsView removeAllObjects];
}

- (void)searchControl:(KBSearchControl *)searchControl progressEnabled:(BOOL)progressEnabled {
  _progressView.animating = progressEnabled;
}

- (void)searchControl:(KBSearchControl *)searchControl shouldSearchWithQuery:(NSString *)query completion:(void (^)(NSError *error, NSArray *searchResults))completion {
  [AppDelegate.APIClient searchUsersWithQuery:query success:^(NSArray *searchResults) {
    completion(nil, searchResults);
  } failure:^(NSError *error) {
    completion(error, nil);
  }];
}

@end
