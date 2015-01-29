//
//  KBCatalogView.m
//  Keybase
//
//  Created by Gabriel on 1/16/15.
//  Copyright (c) 2015 Gabriel Handford. All rights reserved.
//

#import "KBCatalogView.h"
#import "AppDelegate.h"
#import "KBUserProfileView.h"
#import "KBUsersView.h"
#import "KBWebView.h"
#import "KBKeyGenView.h"
#import "KBTwitterConnectView.h"

@interface KBCatalogView ()
@property NSMutableArray *items;

@property NSScrollView *scrollView;
@property NSTableView *tableView;
@end

@implementation KBCatalogView

- (void)viewInit {
  [super viewInit];
  _items = [NSMutableArray array];

  [_items addObject:@{@"name": @"Login", @"block":^{ [self showLogin:YES]; }}];
  [_items addObject:@{@"name": @"Signup", @"block":^{ [self showSignup:YES]; }}];
  [_items addObject:@{@"name": @"KeyGen", @"block":^{ [self showKeyGen:YES]; }}];
  [_items addObject:@{@"name": @"TwitterConnect", @"block":^{ [self showTwitterConnect:YES]; }}];
  [_items addObject:@{@"name": @"Users", @"block":^{ [self showUsers]; }}];
  [_items addObject:@{@"name": @"Tracking", @"block":^{ [self showTracking]; }}];
  [_items addObject:@{@"name": @"Password Prompt", @"block":^{ [self passwordPrompt]; }}];

  _scrollView = [[NSScrollView alloc] init];
  [self addSubview:_scrollView];

  _tableView = [[NSTableView alloc] init];
  _tableView.dataSource = self;
  _tableView.delegate = self;
  [_tableView setHeaderView:nil];

  NSTableColumn *column1 = [[NSTableColumn alloc] initWithIdentifier:@""];
  //[column1 setWidth:360];
  [_tableView addTableColumn:column1];

  [_scrollView setDocumentView:_tableView];

  [self.tableView reloadData];

  YOSelf yself = self;
  self.viewLayout = [YOLayout layoutWithLayoutBlock:^(id<YOLayout> layout, CGSize size) {
    [layout setSize:size view:yself.scrollView options:0];
    return size;
  }];
}

- (void)signupView:(KBSignupView *)signupView didSignupWithStatus:(KBRGetCurrentStatusRes *)status {
  AppDelegate.sharedDelegate.status = status;
  [self.navigation popViewAnimated:YES];
}

- (void)loginView:(KBLoginView *)loginView didLoginWithStatus:(KBRGetCurrentStatusRes *)status {
  AppDelegate.sharedDelegate.status = status;
  [self.navigation popViewAnimated:YES];
}

- (void)showLogin:(BOOL)animated {
  KBConnectView *connectView = [[KBConnectView alloc] init];
  connectView.loginView.delegate = self;
  [connectView showLogin:animated];
  [self.navigation pushView:connectView animated:animated];
}

- (void)showSignup:(BOOL)animated {
  KBConnectView *connectView = [[KBConnectView alloc] init];
  connectView.signupView.delegate = self;
  [connectView showSignup:animated];
  [self.navigation pushView:connectView animated:animated];
}

- (void)showKeyGen:(BOOL)animated {
  KBKeyGenView *keyGenView = [[KBKeyGenView alloc] init];
  [self.navigation pushView:keyGenView animated:animated];
}

- (void)showTwitterConnect:(BOOL)animated {
  KBTwitterConnectView *twitterView = [[KBTwitterConnectView alloc] init];
  [self.navigation pushView:twitterView animated:animated];
}

- (void)passwordPrompt {
  NSString *description = @"Please enter your Keybase.io login passphrase to unlock the secret key for:\nuser: keybase.io/thisisjustatestuser <thisisjustatestuser@keybase.io>\n  4096-bit RSA key, ID XXXXXXXXXXXXXXX, created 2015-01-27\n\nReason: tracking signature";
  [AppDelegate passwordPrompt:@"Your key passphrase" description:description view:nil completion:^(BOOL canceled, NSString *password) {

  }];
}

- (void)showUsers {
  KBUsersView *usersView = [[KBUsersView alloc] init];
  [usersView loadUsernames:@[@"gabrielh", @"max", @"chris", @"strib", @"patrick", @"min", @"amiruci", @"relme", @"feldstein", @"bobloblaw"]];
  [self.navigation pushView:usersView animated:YES];
}

- (void)showTracking {
  KBRUser *user = [[KBRUser alloc] initWithDictionary:@{@"uid": [@"b7c2eaddcced7727bcb229751d91e800" na_dataFromHexString], @"username": @"gabrielh"} error:nil];

  KBUserProfileView *userProfileView = [[KBUserProfileView alloc] init];
  KBWindow *window = [KBWindow windowWithContentView:userProfileView size:CGSizeMake(360, 500) retain:YES];
  window.navigation.titleView = [KBTitleView titleViewWithTitle:user.username navigation:window.navigation];
  [window setLevel:NSStatusWindowLevel];
  [window makeKeyAndOrderFront:nil];

  [userProfileView setUser:user track:YES];
}

- (NSInteger)numberOfRowsInTableView:(NSTableView *)tableView {
  return [_items count];
}

- (NSTableRowView *)tableView:(NSTableView *)tableView rowViewForRow:(NSInteger)row {
  return [[KBTableRowView alloc] init];
}

- (NSView *)tableView:(NSTableView *)tableView viewForTableColumn:(NSTableColumn *)tableColumn row:(NSInteger)row {
  NSDictionary *obj = [_items objectAtIndex:row];

  KBLabel *view = [_tableView makeViewWithIdentifier:@"text" owner:self];
  if (!view) {
    view = [[KBLabel alloc] init];
    view.identifier = @"text";
  }
  [view setText:obj[@"name"] font:[NSFont systemFontOfSize:20] color:[KBLookAndFeel textColor] alignment:NSCenterTextAlignment];
  return view;
}

- (void)tableViewSelectionDidChange:(NSNotification *)notification {
  NSTableView *tableView = notification.object;

  if (tableView.selectedRow >= 0) {
    NSDictionary *obj = [_items objectAtIndex:tableView.selectedRow];
    dispatch_block_t block = obj[@"block"];
    block();
  }

  [tableView deselectAll:nil];
}

- (CGFloat)tableView:(NSTableView *)tableView heightOfRow:(NSInteger)row {
  return 50;
}

@end
