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
@property NSScrollView *scrollView;
@property NSTableView *tableView;
@property NSMutableArray *usersDataSource;

@property KBUserView *prototypeView;
@end


@implementation KBUsersView

- (void)viewInit {
  [super viewInit];
  _usersDataSource = [NSMutableArray array];

  _tableView = [[NSTableView alloc] init];
  _tableView.dataSource = self;
  _tableView.delegate = self;
  [_tableView setHeaderView:nil];

  NSTableColumn *column1 = [[NSTableColumn alloc] initWithIdentifier:@""];
  [_tableView addTableColumn:column1];

  _scrollView = [[NSScrollView alloc] init];
  [_scrollView setHasVerticalScroller:YES];
  [_scrollView setAutoresizingMask:NSViewWidthSizable|NSViewHeightSizable];
  [_scrollView setDocumentView:_tableView];
  [self addSubview:_scrollView];

  YOSelf yself = self;
  self.viewLayout = [YOLayout layoutWithLayoutBlock:^(id<YOLayout> layout, CGSize size) {
    [layout setSize:size view:yself.scrollView options:0];
    return size;
  }];
}

- (void)loadUsernames:(NSArray *)usernames {
  self.progressIndicatorEnabled = YES;
  [AppDelegate.APIClient usersForKey:@"usernames" value:[usernames join:@","] fields:nil success:^(NSArray *users) {
    self.progressIndicatorEnabled = NO;
    [self setUsers:users];
  } failure:self.errorHandler];
}

- (void)setUsers:(NSArray *)users {
  [_usersDataSource removeAllObjects];
  [_usersDataSource addObjectsFromArray:users];
  [_tableView reloadData];
}

- (NSInteger)numberOfRowsInTableView:(NSTableView *)tableView {
  return [_usersDataSource count];
}

- (NSTableRowView *)tableView:(NSTableView *)tableView rowViewForRow:(NSInteger)row {
  return [[KBTableRowView alloc] init];
}

- (NSView *)tableView:(NSTableView *)tableView viewForTableColumn:(NSTableColumn *)tableColumn row:(NSInteger)row {
  KBUser *user = [_usersDataSource objectAtIndex:row];
  KBUserView *view = [_tableView makeViewWithIdentifier:@"user" owner:self];
  if (!view) {
    view = [[KBUserView alloc] init];
    view.identifier = @"user";
  }
  [view setUser:user];
  return view;
}

- (CGFloat)tableView:(NSTableView *)tableView heightOfRow:(NSInteger)row {
  if (!_prototypeView) _prototypeView = [[KBUserView alloc] init];
  KBUser *user = [_usersDataSource objectAtIndex:row];
  [_prototypeView setUser:user];
  return [_prototypeView sizeThatFits:tableView.frame.size].height;
}

- (void)tableViewSelectionDidChange:(NSNotification *)notification {
  NSInteger selectedRow = [_tableView selectedRow];
  if (selectedRow >= 0) {
    NSTableRowView *rowView = [_tableView rowViewAtRow:selectedRow makeIfNecessary:NO];
    [rowView setEmphasized:NO];
    KBUser *user = [_usersDataSource objectAtIndex:selectedRow];
    KBUserProfileView *userProfileView = [[KBUserProfileView alloc] init];
    KBRUser *ruser = [[KBRUser alloc] initWithDictionary:@{@"uid": [user.identifier na_dataFromHexString], @"username": user.userName} error:nil];
    [self.navigation pushView:userProfileView animated:YES];
    [userProfileView setUser:ruser track:YES];
  }
  [_tableView deselectAll:nil];
}

@end
