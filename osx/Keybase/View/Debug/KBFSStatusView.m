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
#import "KBHelperTool.h"

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

  KBButton *installHelperButton = [KBButton buttonWithText:@"Install" style:KBButtonStyleToolbar];
  installHelperButton.targetBlock = ^{ [gself installHelper]; };
  [buttons2 addSubview:installHelperButton];

  KBButton *checkButton = [KBButton buttonWithText:@"Version" style:KBButtonStyleToolbar];
  checkButton.targetBlock = ^{ [gself sendRequest:@"version"]; };
  [buttons2 addSubview:checkButton];

  YOHBox *buttons3 = [YOHBox box:@{@"spacing": @"10"}];
  [contentView addSubview:buttons3];

  KBButton *installKBFSButton = [KBButton buttonWithText:@"Install KBFS" style:KBButtonStyleToolbar];
  installKBFSButton.targetBlock = ^{ [gself sendRequest:@"kbfs_install"]; };
  [buttons3 addSubview:installKBFSButton];

  KBButton *uninstallButton = [KBButton buttonWithText:@"Uninstall KBFS" style:KBButtonStyleToolbar];
  uninstallButton.targetBlock = ^{ [gself sendRequest:@"kbfs_uninstall"]; };
  [buttons3 addSubview:uninstallButton];

  YOHBox *buttons4 = [YOHBox box:@{@"spacing": @"10"}];
  [contentView addSubview:buttons4];

  KBButton *loadButton = [KBButton buttonWithText:@"Load KBFS" style:KBButtonStyleToolbar];
  loadButton.targetBlock = ^{ [gself sendRequest:@"kbfs_load"]; };
  [buttons4 addSubview:loadButton];

  KBButton *unloadButton = [KBButton buttonWithText:@"Unload KBFS" style:KBButtonStyleToolbar];
  unloadButton.targetBlock = ^{ [gself sendRequest:@"kbfs_unload"]; };
  [buttons4 addSubview:unloadButton];

  YOHBox *buttons5 = [YOHBox box:@{@"spacing": @"10"}];
  [contentView addSubview:buttons5];

  KBButton *cliButton = [KBButton buttonWithText:@"Install CLI" style:KBButtonStyleToolbar];
  cliButton.targetBlock = ^{ [gself sendRequest:@"cli_install"]; };
  [buttons5 addSubview:cliButton];

  self.viewLayout = [YOLayout fill:contentView];
}

- (void)installHelper {
  KBHelperTool *helperInstall = [[KBHelperTool alloc] init];
  [helperInstall install:^(NSError *error) {
    if (error) KBConsoleError(error);
    else KBConsoleLog(@"Installed");
  }];
}

- (void)sendRequest:(NSString *)method {
  if (!_client) _client = [[MPXPCClient alloc] initWithServiceName:@"keybase.Helper" priviledged:YES];
  [_client sendRequest:method params:nil completion:^(NSError *error, id value) {
    if (error) KBConsoleError(error);
    else KBConsoleLog(@"Helper; %@: %@", method, value);
  }];
}

@end

