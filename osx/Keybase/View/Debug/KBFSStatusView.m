//
//  KBTestHelperView.m
//  Keybase
//
//  Created by Gabriel on 4/17/15.
//  Copyright (c) 2015 Gabriel Handford. All rights reserved.
//

#import "KBFSStatusView.h"

#import "AppDelegate.h"
#import <MPMessagePack/MPXPCClient.h>

@interface KBFSStatusView ()
@property MPXPCClient *client;
@end

@implementation KBFSStatusView

- (void)viewInit {
  [super viewInit];

  YOVBox *contentView = [YOVBox box:@{@"insets": @(20), @"spacing": @(10)}];
  [self addSubview:contentView];

  GHWeakSelf gself = self;
  YOHBox *buttons2 = [YOHBox box:@{@"spacing": @"10"}];
  [contentView addSubview:buttons2];

  KBButton *checkButton = [KBButton buttonWithText:@"Version" style:KBButtonStyleToolbar];
  checkButton.targetBlock = ^{ [gself sendRequest:@"version"]; };
  [buttons2 addSubview:checkButton];

  KBButton *statusButton = [KBButton buttonWithText:@"Status" style:KBButtonStyleToolbar];
  statusButton.targetBlock = ^{ [gself sendRequest:@"status"]; };
  [buttons2 addSubview:statusButton];

  YOHBox *buttons3 = [YOHBox box:@{@"spacing": @"10"}];
  [contentView addSubview:buttons3];

  KBButton *loadButton = [KBButton buttonWithText:@"Load KBFS" style:KBButtonStyleToolbar];
  loadButton.targetBlock = ^{ [gself sendRequest:@"load_kbfs"]; };
  [buttons3 addSubview:loadButton];

  KBButton *unloadButton = [KBButton buttonWithText:@"Unload KBFS" style:KBButtonStyleToolbar];
  unloadButton.targetBlock = ^{ [gself sendRequest:@"unload_kbfs"]; };
  [buttons3 addSubview:unloadButton];

  KBButton *uninstallButton = [KBButton buttonWithText:@"Uninstall KBFS" style:KBButtonStyleToolbar];
  uninstallButton.targetBlock = ^{ [gself sendRequest:@"uninstall_kbfs"]; };
  [buttons3 addSubview:uninstallButton];

  self.viewLayout = [YOLayout fill:contentView];
}

- (void)sendRequest:(NSString *)method {
  if (!_client) _client = [[MPXPCClient alloc] initWithServiceName:@"keybase.Helper" priviledged:YES];
  [_client sendRequest:method params:nil completion:^(NSError *error, id value) {
    if (error) KBConsoleError(error);
    else KBConsoleLog(@"%@: %@", method, value);
  }];
}

@end

