//
//  KBUsersAppView.m
//  Keybase
//
//  Created by Gabriel on 2/6/15.
//  Copyright (c) 2015 Gabriel Handford. All rights reserved.
//

#import "KBUsersAppView.h"

#import "KBUserProfileView.h"
#import "KBProgressOverlayView.h"
#import "KBUserView.h"
#import "KBSearchField.h"
#import "KBViews.h"
#import "KBUserListView.h"
#import "KBSearcher.h"
#import "KBNotifications.h"

@interface KBUsersAppView ()
@property KBSearchControl *searchField;
@property NSPopUpButton *menuButton;

@property KBUserListView *trackingView;
@property KBUserListView *trackersView;
@property KBUserListView *searchView;
@property KBViews *views;

@property KBUserProfileViewer *trackingUserView;
@property KBUserProfileViewer *trackersUserView;
@property KBUserProfileViewer *searchUserView;
@property KBViews *userViews;
@property KBActivityIndicatorView *listProgressView;

@property KBActivityIndicatorView *searchProgressView;
@property NSString *searchText;
@property KBSearcher *search;
@end

@implementation KBUsersAppView

- (void)viewInit {
  [super viewInit];

  YOSelf yself = self;

  _searchField = [[KBSearchField alloc] init];
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

  GHWeakSelf gself = self;
  _trackingView = [[KBUserListView alloc] init];
  _trackingView.identifier = @"Tracking";
  _trackingView.listView.onSelect = ^(KBTableView *tableView, KBTableSelection *selection) {
    KBRUserSummary *userSummary = selection.object;
    [gself.trackingUserView setUsername:userSummary.username client:gself.client];
  };

  _trackersView = [[KBUserListView alloc] init];
  _trackersView.identifier = @"Trackers";
  _trackersView.listView.onSelect = ^(KBTableView *tableView, KBTableSelection *selection) {
    KBRUserSummary *userSummary = selection.object;
    [gself.trackersUserView setUsername:userSummary.username client:gself.client];
  };

  _views = [[KBViews alloc] init];
  [_views setViews:@[_trackingView, _trackersView]];
  [self addSubview:_views];

  _userViews = [[KBViews alloc] init];
  _trackingUserView = [[KBUserProfileViewer alloc] init];
  _trackingUserView.identifier = @"Tracking";
  _trackersUserView = [[KBUserProfileViewer alloc] init];
  _trackersUserView.identifier = @"Trackers";
  [_userViews setViews:@[_trackingUserView, _trackersUserView]];
  [self addSubview:_userViews];

  _searchProgressView = [[KBActivityIndicatorView alloc] init];
  _searchProgressView.lineWidth = 1.0;
  [self addSubview:_searchProgressView];

  _listProgressView = [[KBActivityIndicatorView alloc] init];
  _listProgressView.lineWidth = 1.0;
  [self addSubview:_listProgressView];

  _searchView = [[KBUserListView alloc] init];
  _searchView.listView.onSelect = ^(KBTableView *tableView, KBTableSelection *selection) {
    KBRUserSummary *userSummary = selection.object;
    [gself.searchUserView setUsername:userSummary.username client:gself.client];
  };
  _searchUserView = [[KBUserProfileViewer alloc] init];

  KBBox *borderMiddle = [KBBox line];
  [self addSubview:borderMiddle];

  self.viewLayout = [YOLayout layoutWithLayoutBlock:^(id<YOLayout> layout, CGSize size) {

    CGFloat col = 240;
    // If this y is too small, the search field focus will conflict with the window title bar drag
    // and the search field will become really janky.
    // This isn't an issue anymore after I added KBAppTitleView but it was such an annoying bug I am
    // leaving this comment here.
    CGFloat y = 10;

    [layout setFrame:CGRectMake(col - 46, y + 4, 14, 14) view:yself.searchProgressView];

    y += [layout setFrame:CGRectMake(10, y, col - 21, 22) view:yself.searchField].size.height + 9;

    [layout setFrame:CGRectMake(0, y, col, size.height) view:yself.searchView];

    [layout setFrame:CGRectMake(7, y + 5, 14, 14) view:yself.listProgressView];
    y += [layout setFrame:CGRectMake(13, y, col - 21, 23) view:yself.menuButton].size.height + 4;

    [layout setFrame:CGRectMake(0, y, col - 1, size.height - y) view:yself.views];

    [layout setFrame:CGRectMake(col - 1, 0, 1, size.height) view:borderMiddle];
    [layout setFrame:CGRectMake(col, 0, size.width - col, size.height) view:yself.userViews];
    [layout setFrame:CGRectMake(col, 0, size.width - col, size.height) view:yself.searchUserView];

    return size;
  }];

  [self showTracking:self];
  [_menuButton selectItemAtIndex:0];
  [NSNotificationCenter.defaultCenter addObserver:self selector:@selector(update) name:KBTrackingListDidChangeNotification object:nil];
}

- (void)dealloc {
  [NSNotificationCenter.defaultCenter removeObserver:self];
}

- (void)showTracking:(id)sender {
  [_views showViewWithIdentifier:@"Tracking"];
  [_userViews showViewWithIdentifier:@"Tracking"];
  [_menuButton setTitle:@"Tracking"];
  if (!_trackingView.listView.selectedObject) [_trackingUserView clear];
}

- (void)showTrackers:(id)sender {
  [_views showViewWithIdentifier:@"Trackers"];
  [_userViews showViewWithIdentifier:@"Trackers"];
  [_menuButton setTitle:@"Trackers"];
  if (!_trackersView.listView.selectedObject) [_trackersUserView clear];
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

  _listProgressView.animating = YES;
  KBRUserRequest *trackingRequest = [[KBRUserRequest alloc] initWithClient:self.client];
  [trackingRequest listTrackingWithSessionID:trackingRequest.sessionId filter:nil completion:^(NSError *error, NSArray *userSummaries) {
    gself.listProgressView.animating = NO;
    if (error) {
      [KBActivity setError:error sender:self];
      [gself.trackingView.listView removeAllObjects];
      return;
    }
    [self setTracking:userSummaries update:update];
  }];

  [self trackersUsers:^(NSError *error, NSArray *userSummaries) {
    gself.listProgressView.animating = NO;
    if (error) {
      [KBActivity setError:error sender:self];
      [gself.trackersView.listView removeAllObjects];
      return;
    }
    [self setTrackers:userSummaries update:update];
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
    [trackersRequest loadUncheckedUserSummariesWithSessionID:trackersRequest.sessionId uids:uids completion:^(NSError *error, NSArray *userSummaries) {
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
  [_trackingView setUserSummaries:userSummaries update:update];
}

- (void)setTrackers:(NSArray *)userSummaries update:(BOOL)update {
  [_trackersView setUserSummaries:userSummaries update:update];
}

#pragma mark Search

- (void)showSearch {
  if (![_searchView superview]) {
    [self addSubview:_searchView positioned:NSWindowAbove relativeTo:_views];
  }
  if (![_searchUserView superview]) {
    [self addSubview:_searchUserView positioned:NSWindowAbove relativeTo:_userViews];
  }
}

- (void)hideSearch {
  [_searchView removeFromSuperview];
  [_searchUserView removeFromSuperview];
}

- (void)searchControlShouldOpen:(KBSearchControl *)searchControl {
  [self showSearch];
  if (!_searchView.listView.selectedObject) {
    [_searchUserView clear];
  }
}

- (void)searchControlShouldClose:(KBSearchControl *)searchControl {
  [self hideSearch];
}

- (void)searchControl:(KBSearchControl *)searchControl shouldDisplaySearchResults:(KBSearchResults *)searchResults {
  NSInteger previousCount = [_searchView.listView rowCount];

  NSSet *usernames = [NSSet setWithArray:[[_searchView.listView objectsWithoutHeaders] map:^(KBRUserSummary *us) { return us.username; }]];
  NSArray *filtered = [searchResults.results reject:^BOOL(KBRUserSummary *us) { return [usernames containsObject:us.username]; }];
  NSMutableArray *results = [filtered mutableCopy];
  if (searchResults.header && [results count] > 0) [results insertObject:[KBTableViewHeader tableViewHeaderWithTitle:searchResults.header] atIndex:0];
  // Datasource might have been altered without reload here (if previousCount == 0), so animation won't work in that case (see reloadDelay)
  [_searchView.listView addObjects:results animation:previousCount > 0 ? NSTableViewAnimationSlideUp : NSTableViewAnimationEffectNone];
  [self showSearch];
}

- (void)searchControlShouldClearSearchResults:(KBSearchControl *)searchControl {
  //[_searchView.listView removeAllObjects];
  [_searchView.listView.dataSource removeAllObjects];
  [_search reloadDelay:_searchView.listView];
}

- (void)searchControl:(KBSearchControl *)searchControl progressEnabled:(BOOL)progressEnabled {
  _searchProgressView.animating = progressEnabled;
}

- (void)searchControl:(KBSearchControl *)searchControl shouldSearchWithQuery:(NSString *)query delay:(BOOL)delay completion:(void (^)(NSError *error, KBSearchResults *searchResults))completion {
  if (!_search) _search = [[KBSearcher alloc] init];
  [_search search:query client:self.client remote:delay completion:completion];
}

@end
