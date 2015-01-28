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

@interface KBCatalogView ()
@property NSMutableArray *items;

@property NSScrollView *scrollView;
@property NSTableView *tableView;
@end

@implementation KBCatalogView

- (void)viewInit {
  [super viewInit];
  _items = [NSMutableArray array];

  GHWeakSelf gself = self;
  [_items addObject:@{@"name": @"Login", @"block":^{ [AppDelegate.sharedDelegate.catalogController showLogin:YES]; }}];
  [_items addObject:@{@"name": @"Signup", @"block":^{ [AppDelegate.sharedDelegate.catalogController showSignup:YES]; }}];
  [_items addObject:@{@"name": @"KeyGen", @"block":^{ [AppDelegate.sharedDelegate.catalogController showKeyGen:YES]; }}];
  [_items addObject:@{@"name": @"TwitterConnect", @"block":^{ [AppDelegate.sharedDelegate.catalogController showTwitterConnect:YES]; }}];
  [_items addObject:@{@"name": @"Users", @"block":^{ [self showUsers]; }}];
  [_items addObject:@{@"name": @"Tracking", @"block":^{ [self showTracking]; }}];
  [_items addObject:@{@"name": @"Password Prompt", @"block":^{ [gself passwordPrompt]; }}];

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
    [layout setSize:size view:yself.scrollView];
    return size;
  }];
}

- (void)passwordPrompt {
  NSString *description = @"Please enter your Keybase.io login passphrase to unlock the secret key for:\nuser: keybase.io/gbrl27 <gbrl27@keybase.io>\n  4096-bit RSA key, ID 47FFDF4E65C0037F, created 2015-01-27\n\nReason: tracking signature";
  [AppDelegate passwordPrompt:@"Your key passphrase" description:description view:nil completion:^(BOOL canceled, NSString *password) {
   // Password
  }];
}

- (void)showUsers {
  KBUsersView *usersView = [[KBUsersView alloc] init];
  [usersView loadUsernames:@[@"gabrielh", @"max", @"chris", @"strib", @"patrick", @"min", @"amiruci", @"relme", @"feldstein"]];
  [self.navigation pushView:usersView animated:YES];
}

- (void)showTracking {
  KBUserProfileView *userProfileView = [[KBUserProfileView alloc] init];
  KBRUser *user = [[KBRUser alloc] initWithDictionary:@{@"uid": [@"dbb165b7879fe7b1174df73bed0b9500" na_dataFromHexString], @"username": @"max"} error:nil];
  [userProfileView setUser:user track:YES];
  [self.navigation pushView:userProfileView animated:YES];
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
