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
  _usersView.cellSetBlock = ^(KBUserView *view, KBRUserSummary *userSummary, NSIndexPath *indexPath, id containingView, BOOL dequeued) {
    [view setUserSummary:userSummary];
  };
  _usersView.selectBlock = ^(id sender, NSIndexPath *indexPath, KBRUserSummary *userSummary) {
    [yself selectUser:userSummary.username];
  };
  [self addSubview:_usersView];

  _searchResultsView = [KBListView listViewWithPrototypeClass:KBSearchResultView.class rowHeight:56];
  _searchResultsView.cellSetBlock = ^(KBSearchResultView *view, KBSearchResult *searchResult, NSIndexPath *indexPath, id containingView, BOOL dequeued) {
    [view setSearchResult:searchResult];
  };
  _searchResultsView.selectBlock = ^(id sender, NSIndexPath *indexPath, KBSearchResult *searchResult) {
    [yself selectUser:searchResult.userName];
  };
  [self addSubview:_searchResultsView positioned:NSWindowAbove relativeTo:_usersView];

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

  [NSNotificationCenter.defaultCenter addObserver:self selector:@selector(update) name:KBTrackingListDidChangeNotification object:nil];
  [self hideSearch];
}

- (void)dealloc {
  [NSNotificationCenter.defaultCenter removeObserver:self];
}

- (void)viewDidAppear:(BOOL)animated {
  [self reload:NO];
}

- (void)reload:(BOOL)update {
  KBRUserRequest *request = [[KBRUserRequest alloc] initWithClient:self.client];
  [request listTrackingWithFilter:nil completion:^(NSError *error, NSArray *items) {
    [self loadUsernames:[items map:^(KBRTrackEntry *te) { return te.username; }] completion:^(NSError *error, NSArray *userSummaries) {
      [self setUserSummaries:userSummaries update:NO];
    }];
  }];
}

- (void)update {
  [self reload:YES];
}

- (void)loadUserIds:(NSArray *)userIds {
  KBRUserRequest *request = [[KBRUserRequest alloc] initWithClient:self.client];
  [request loadUncheckedUserSummariesWithUids:userIds completion:^(NSError *error, NSArray *items) {
  }];
}

- (void)setUserSummaries:(NSArray *)userSummaries update:(BOOL)update {
  [_usersView setObjects:userSummaries animated:update];
}

- (void)setUser:(KBRUser *)user {
  [_usersView removeAllObjects];
  [_userProfileView clear];
  [self selectUser:user.username];
}

- (void)selectUser:(NSString *)username {
  KBRUser *user = [[KBRUser alloc] init];
  user.username = username;
  BOOL editable = [AppDelegate.appView.user.username isEqual:user.username];
  [_userProfileView setUser:user editable:editable client:self.client];
}

- (void)loadUsernames:(NSArray *)usernames completion:(void (^)(NSError *error, NSArray *userSummaries))completion {
  //self.progressIndicatorEnabled = YES;
  [AppDelegate.sharedDelegate.APIClient usersForKey:@"usernames" value:[usernames join:@","] fields:nil success:^(NSArray *users) {
    //self.progressIndicatorEnabled = NO;
    completion(nil, KBRUserSummariesFromAPIUsers(users));
  } failure:^(NSError *error) {
    completion(error, nil);
  }];
}

NSArray *KBRUserSummariesFromAPIUsers(NSArray *APIUsers) {
  return [APIUsers map:^id(KBUser *APIUser) {
    KBRUserSummary *user = [[KBRUserSummary alloc] init];
    user.uid = (KBRUID *)[APIUser.identifier na_dataFromHexString];
    user.username = APIUser.userName;
    user.proofs = [[KBRProofs alloc] init];
    user.proofs.twitter = [[[APIUser proofsForType:KBProofTypeTwitter] firstObject] displayName];
    user.proofs.github = [[[APIUser proofsForType:KBProofTypeGithub] firstObject] displayName];
    return user;
  }];
}

KBRUser *KBRUserFromSearchResult(KBSearchResult *searchResult) {
  KBRUser *user = [[KBRUser alloc] init];
  user.uid = (KBRUID *)[searchResult.userId na_dataFromHexString];
  user.username = searchResult.userName;
  return user;
}

KBRUser *KBRUserFromTrackEntry(KBRTrackEntry *trackEntry) {
  KBRUser *user = [[KBRUser alloc] init];
  user.username = trackEntry.username;
  return user;
}

#pragma mark Search

- (void)showSearch {
  _usersView.hidden = YES;
  _searchResultsView.hidden = NO;
}

- (void)hideSearch {
  _usersView.hidden = NO;
  _searchResultsView.hidden = YES;
}

- (void)searchControlShouldOpen:(KBSearchControl *)searchControl {
  [self showSearch];
}

- (void)searchControlShouldClose:(KBSearchControl *)searchControl {
  [self hideSearch];
}

- (void)searchControl:(KBSearchControl *)searchControl shouldDisplaySearchResults:(NSArray *)searchResults {
  [_searchResultsView setObjects:searchResults];
  [self showSearch];
}

- (void)searchControlShouldClearSearchResults:(KBSearchControl *)searchControl {
  [_searchResultsView removeAllObjects];
}

- (void)searchControl:(KBSearchControl *)searchControl progressEnabled:(BOOL)progressEnabled {
  _progressView.animating = progressEnabled;
}

- (void)searchControl:(KBSearchControl *)searchControl shouldSearchWithQuery:(NSString *)query completion:(void (^)(NSError *error, NSArray *searchResults))completion {
  [AppDelegate.sharedDelegate.APIClient searchUsersWithQuery:query success:^(NSArray *searchResults) {
    completion(nil, searchResults);
  } failure:^(NSError *error) {
    completion(error, nil);
  }];
}

@end
