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
#import "KBViews.h"

@interface KBUsersAppView ()
@property KBSearchControl *searchField;
@property KBListView *trackingView;
@property KBListView *trackersView;
@property KBListView *searchResultsView;
@property KBUserProfileView *userProfileView;

@property NSPopUpButton *menuButton;
@property KBViews *views;

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

  NSMenu *menu = [[NSMenu alloc] init];
  [menu addItemWithTitle:@"" action:NULL keyEquivalent:@""];
  NSMenuItem *item;
  item = [menu addItemWithTitle:@"Tracking" action:@selector(showTracking:) keyEquivalent:@""];
  item.target = self;
  item = [menu addItemWithTitle:@"Trackers" action:@selector(showTrackers:) keyEquivalent:@""];
  item.target = self;
  _menuButton = [[NSPopUpButton alloc] initWithFrame:CGRectMake(0, 0, 320, 23) pullsDown:YES];
  [_menuButton.cell setArrowPosition:NSPopUpArrowAtBottom];
  _menuButton.bordered = NO;
  [_menuButton setTarget:self];
  [_menuButton setMenu:menu];
  [self addSubview:_menuButton];

  _trackingView = [KBListView listViewWithPrototypeClass:KBUserView.class rowHeight:56];
  [_trackingView setBorderEnabled:YES];
  _trackingView.cellSetBlock = ^(KBUserView *view, KBRUserSummary *userSummary, NSIndexPath *indexPath, NSTableColumn *tableColumn, id containingView, BOOL dequeued) {
    [view setUserSummary:userSummary];
  };
  _trackingView.selectBlock = ^(id sender, NSIndexPath *indexPath, KBRUserSummary *userSummary) {
    [yself selectUser:userSummary.username];
  };
  _trackingView.identifier = @"Tracking";

  _trackersView = [KBListView listViewWithPrototypeClass:KBUserView.class rowHeight:56];
  [_trackersView setBorderEnabled:YES];
  _trackersView.cellSetBlock = ^(KBUserView *view, KBRUserSummary *userSummary, NSIndexPath *indexPath, NSTableColumn *tableColumn, id containingView, BOOL dequeued) {
    [view setUserSummary:userSummary];
  };
  _trackersView.selectBlock = ^(id sender, NSIndexPath *indexPath, KBRUserSummary *userSummary) {
    [yself selectUser:userSummary.username];
  };
  _trackersView.identifier = @"Trackers";

  _views = [[KBViews alloc] init];
  [_views setViews:@[_trackingView, _trackersView]];
  [self addSubview:_views];
  [self showTracking:self];

  _searchResultsView = [KBListView listViewWithPrototypeClass:KBSearchResultView.class rowHeight:56];
  [_searchResultsView setBorderEnabled:YES];
  _searchResultsView.cellSetBlock = ^(KBSearchResultView *view, KBSearchResult *searchResult, NSIndexPath *indexPath, NSTableColumn *tableColumn, id containingView, BOOL dequeued) {
    [view setSearchResult:searchResult];
  };
  _searchResultsView.selectBlock = ^(id sender, NSIndexPath *indexPath, KBSearchResult *searchResult) {
    [yself selectUser:searchResult.userName];
  };
  _searchResultsView.hidden = YES;
  [self addSubview:_searchResultsView positioned:NSWindowAbove relativeTo:_views];

  _userProfileView = [[KBUserProfileView alloc] init];
  [self addSubview:_userProfileView];

  _progressView = [[KBActivityIndicatorView alloc] init];
  _progressView.lineWidth = 1.0;
  [self addSubview:_progressView];

  KBBox *borderRight = [KBBox line];
  [self addSubview:borderRight];

  self.viewLayout = [YOLayout layoutWithLayoutBlock:^(id<YOLayout> layout, CGSize size) {

    CGFloat col1 = 240;
    // If this y is too small, the search field focus will conflict with the window title bar drag
    // and the search field will become really janky.
    // This isn't an issue anymore after I added KBAppTitleView but it was such an annoying bug I am
    // leaving this comment here.
    CGFloat y = 10;

    [layout setFrame:CGRectMake(col1 - 46, y + 4, 14, 14) view:yself.progressView];

    y += [layout setFrame:CGRectMake(10, y, col1 - 21, 22) view:yself.searchField].size.height + 9;

    [layout setFrame:CGRectMake(-1, y, col1 + 1, size.height - y) view:yself.searchResultsView];

    y += [layout setFrame:CGRectMake(9, y, col1 - 21, 23) view:yself.menuButton].size.height + 4;

    //[layout setFrame:CGRectMake(0, y, col1 - 1, size.height - y) view:yself.usersView];
    //[layout setFrame:CGRectMake(0, y, col1 - 1, size.height - y) view:yself.trackersView];
    [layout setFrame:CGRectMake(-1, y + 1, col1 + 1, size.height - y) view:yself.views];

    //[layout setFrame:CGRectMake(col1/2.0 - 16, col1y + 20, 32, 32) view:yself.progressView];

    [layout setFrame:CGRectMake(col1 - 1, 0, 1, size.height) view:borderRight];
    [layout setFrame:CGRectMake(col1, 0, size.width - col1, size.height) view:yself.userProfileView];

    return size;
  }];

  [_menuButton selectItemAtIndex:0];
  [NSNotificationCenter.defaultCenter addObserver:self selector:@selector(update) name:KBTrackingListDidChangeNotification object:nil];
}

- (void)dealloc {
  [NSNotificationCenter.defaultCenter removeObserver:self];
}

- (void)showTracking:(id)sender {
  [_views showViewWithIdentifier:@"Tracking"];
  [_menuButton setTitle:@"Tracking"];
}

- (void)showTrackers:(id)sender {
  [_views showViewWithIdentifier:@"Trackers"];
  [_menuButton setTitle:@"Trackers"];
}

- (BOOL)validateMenuItem:(NSMenuItem *)menuItem {
  BOOL on = [[menuItem title] isEqualTo:_views.visibleIdentifier];
  [menuItem setState:on ? NSOnState : NSOffState];
  return YES;
}

- (void)viewDidAppear:(BOOL)animated {
  [self reload:NO];
}

- (void)reload:(BOOL)update {
  GHWeakSelf gself = self;
  
  KBRUserRequest *trackingRequest = [[KBRUserRequest alloc] initWithClient:self.client];
  _trackingView.progressView.animating = YES;
  [trackingRequest listTrackingWithFilter:nil completion:^(NSError *error, NSArray *userSummaries) {
    gself.trackingView.progressView.animating = NO;
    if (error) {
      [AppDelegate setError:error sender:self];
      [gself.trackingView removeAllObjects];
      return;
    }
    [self setTracking:userSummaries update:NO];
  }];

  [self trackersUsers:^(NSError *error, NSArray *userSummaries) {
    gself.trackersView.progressView.animating = NO;
    if (error) {
      [AppDelegate setError:error sender:self];
      [gself.trackersView removeAllObjects];
      return;
    }
    [self setTrackers:userSummaries update:NO];
  }];
}

- (void)trackersUsers:(void (^)(NSError *error, NSArray *userSummaries))completion {
  KBRUserRequest *trackersRequest = [[KBRUserRequest alloc] initWithClient:self.client];
  [trackersRequest listTrackersSelfWithSessionID:trackersRequest.sessionId completion:^(NSError *error, NSArray *trackers) {
    if (error) {
      completion(error, nil);
      return;
    }
    NSArray *uids = [trackers map:^id(KBRTracker *t) { return t.tracker; }];
    KBRUserRequest *trackersRequest = [[KBRUserRequest alloc] initWithClient:self.client];
    [trackersRequest loadUncheckedUserSummariesWithUids:uids completion:^(NSError *error, NSArray *userSummaries) {
      if (error) {
        completion(error, nil);
        return;
      }
      completion(nil, userSummaries);
    }];
  }];
}

- (void)update {
  [self reload:YES];
}

- (void)setTracking:(NSArray *)userSummaries update:(BOOL)update {
  [_trackingView setObjects:userSummaries animated:update];
}

- (void)setTrackers:(NSArray *)userSummaries update:(BOOL)update {
  [_trackersView setObjects:userSummaries animated:update];
}

- (void)setUser:(KBRUser *)user {
  [_trackingView removeAllObjects];
  [_userProfileView clear];
  [self selectUser:user.username];
}

- (void)selectUser:(NSString *)username {
  KBRUser *user = [[KBRUser alloc] init];
  user.username = username;
  BOOL editable = [AppDelegate.appView.user.username isEqual:user.username];
  _userProfileView.client = self.client;
  [_userProfileView setUsername:user.username editable:editable];
}

//- (void)loadUsernames:(NSArray *)usernames completion:(void (^)(NSError *error, NSArray *userSummaries))completion {
//  [AppDelegate.sharedDelegate.APIClient usersForKey:@"usernames" value:[usernames join:@","] fields:nil success:^(NSArray *users) {
//    completion(nil, KBRUserSummariesFromAPIUsers(users));
//  } failure:^(NSError *error) {
//    completion(error, nil);
//  }];
//}

KBRUser *KBRUserFromSearchResult(KBSearchResult *searchResult) {
  KBRUser *user = [[KBRUser alloc] init];
  user.uid = (KBRUID *)[searchResult.userId na_dataFromHexString];
  user.username = searchResult.userName;
  return user;
}

#pragma mark Search

- (void)showSearch {
  _searchResultsView.hidden = NO;
}

- (void)hideSearch {
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
