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

@interface KBUsersAppView ()
@property NSSearchField *searchField;
@property KBListView *usersView;
@property KBListView *searchResultsView;
@property KBBox *border;
@property KBUserProfileView *userProfileView;

@property KBBox *borderCol1;

@property KBActivityIndicatorView *progressView;
@property NSString *searchText;
@end

@implementation KBUsersAppView

- (void)viewInit {
  [super viewInit];

  _searchField = [[NSSearchField alloc] init];
  _searchField.delegate = self;
  _searchField.placeholderString = @"Search";
  _searchField.sendsWholeSearchString = YES;
  [_searchField.cell setMaximumRecents:20];
  [self addSubview:_searchField];

  _usersView = [KBListView listViewWithPrototypeClass:KBUserView.class rowHeight:56];
  _usersView.hidden = YES;
  _usersView.cellSetBlock = ^(KBUserView *view, KBRUser *user, NSIndexPath *indexPath, id containingView, BOOL dequeued) {
    [view setUser:user];
  };
  [self addSubview:_usersView];

  _borderCol1 = [KBBox lineWithWidth:1.0 color:KBAppearance.currentAppearance.lineColor];
  [self addSubview:_borderCol1];

  _searchResultsView = [KBListView listViewWithPrototypeClass:KBSearchResultView.class rowHeight:56];
  _searchResultsView.layer.borderWidth = 0;
  _searchResultsView.cellSetBlock = ^(KBSearchResultView *view, KBSearchResult *searchResult, NSIndexPath *indexPath, id containingView, BOOL dequeued) {
    [view setSearchResult:searchResult];
  };
  [self addSubview:_searchResultsView];

  _border = [KBBox lineWithWidth:1.0 color:[KBAppearance.currentAppearance lineColor]];
  [self addSubview:_border];

  _userProfileView = [[KBUserProfileView alloc] init];
  [self addSubview:_userProfileView];

  _progressView = [[KBActivityIndicatorView alloc] init];
  _progressView.lineWidth = 1.0;
  [self addSubview:_progressView];

  YOSelf yself = self;

  _usersView.selectBlock = ^(id sender, NSIndexPath *indexPath, KBRUser *user) {
    [yself.userProfileView setUser:user editable:NO];
  };

  _searchResultsView.selectBlock = ^(id sender, NSIndexPath *indexPath, KBSearchResult *searchResult) {
    [yself.userProfileView setUser:KBRUserFromSearchResult(searchResult) editable:NO];
  };

  self.viewLayout = [YOLayout layoutWithLayoutBlock:^(id<YOLayout> layout, CGSize size) {

    CGFloat col1 = 240;
    // If this y is too small, the search field focus will conflict with the window title bar drag
    // and the search field will become really janky.
    CGFloat col1y = 24;

    [layout setFrame:CGRectMake(col1 - 46, col1y + 4, 14, 14) view:yself.progressView];

    col1y += [layout setFrame:CGRectMake(10, col1y, col1 - 21, 22) view:yself.searchField].size.height + 9;

    [layout setFrame:CGRectMake(0, col1y - 1, col1, 1) view:yself.borderCol1];

    [layout setFrame:CGRectMake(0, col1y, col1 - 1, size.height - col1y) view:yself.usersView];
    [layout setFrame:CGRectMake(0, col1y, col1 - 1, size.height - col1y) view:yself.searchResultsView];

    //[layout setFrame:CGRectMake(col1/2.0 - 16, col1y + 20, 32, 32) view:yself.progressView];

    [layout setFrame:CGRectMake(col1 - 1, 0, 1, size.height) view:yself.border];
    [layout setFrame:CGRectMake(col1, 0, size.width - col1, size.height) view:yself.userProfileView];

    return size;
  }];
}

- (void)controlTextDidChange:(NSNotification *)notification {
  //[self.window makeFirstResponder:_searchField];
  NSString *searchText = [[_searchField stringValue] gh_strip];
  [self search:searchText];
}

- (BOOL)control:(NSControl *)control textShouldBeginEditing:(NSText *)fieldEditor {
  return YES;
}

- (BOOL)control:(NSControl *)control textShouldEndEditing:(NSText *)fieldEditor {
  return YES;
}

- (void)setUser:(KBRUser *)user {
  [_usersView removeAllObjects];
  [_userProfileView clear];
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

#pragma mark -

- (void)setSearchProgressEnabled:(BOOL)searchProgressEnabled {
  //[AppDelegate.appView setProgressEnabled:searchProgressEnabled];
  _progressView.animating = searchProgressEnabled;
}

- (void)search:(NSString *)searchText {
  _searchText = searchText;
  [self _searchRemoteDelay:searchText];
}

- (void)_searchRemoteDelay:(NSString *)searchText {
  GHWeakSelf blockSelf = self;
  _searchText = searchText;

  if (!searchText || [searchText length] < 2) {
    [_searchResultsView removeAllObjects];
    [self setSearchProgressEnabled:NO];
    return;
  }

  [self setSearchProgressEnabled:YES];
  dispatch_after(dispatch_time(DISPATCH_TIME_NOW, 700 * NSEC_PER_MSEC), dispatch_get_main_queue(), ^{
    if ([blockSelf.searchText isEqual:searchText]) {
      [blockSelf _searchRemote:searchText];
    }
  });
}

- (void)_searchRemote:(NSString *)searchText {
  _searchText = searchText;

  [self setSearchProgressEnabled:YES];

  GHWeakSelf gself = self;
  GHDebug(@"Search (API): %@", searchText);

  dispatch_async(dispatch_get_global_queue(DISPATCH_QUEUE_PRIORITY_DEFAULT, 0), ^{
    [AppDelegate.APIClient searchUsersWithQuery:searchText success:^(NSArray *searchResults) {
      dispatch_async(dispatch_get_main_queue(), ^{
        if ([gself.searchText isEqual:searchText]) {
          [self setSearchProgressEnabled:NO];
          [gself.searchResultsView setObjects:searchResults];
        }
      });
    } failure:^(NSError *error) {
      dispatch_async(dispatch_get_main_queue(), ^{
        [AppDelegate setError:error sender:self];
      });
    }];
  });
}

@end
