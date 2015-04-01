//
//  KBConsoleView.m
//  Keybase
//
//  Created by Gabriel on 3/5/15.
//  Copyright (c) 2015 Gabriel Handford. All rights reserved.
//

#import "KBConsoleView.h"

#import "KBMockViews.h"
#import "KBTestClientView.h"
#import "AppDelegate.h"
#import "KBLaunchCtl.h"

@interface KBConsoleView ()
@property KBRuntimeStatusView *runtimeStatusView;
@property KBButton *checkButton;
@property KBButton *restartButton;
@property KBListView *logView;

@property KBRPClient *client;
@end

@implementation KBConsoleView

- (void)viewInit {
  [super viewInit];

  _runtimeStatusView = [[KBRuntimeStatusView alloc] init];
  [self addSubview:_runtimeStatusView];

  YOHBox *buttons = [YOHBox box:@{@"spacing": @"10", @"insets": @"0,0,10,0"}];
  GHWeakSelf gself = self;
  _checkButton = [KBButton buttonWithText:@"Check Status" style:KBButtonStyleToolbar];
  _checkButton.dispatchBlock = ^(KBButton *button, KBButtonCompletion completion) {
    [AppDelegate.appView checkStatus:^(NSError *error) {
      [gself.client.installer.launchCtl status:^(NSError *error, NSInteger pid) {
        [gself log:NSStringWithFormat(@"keybased pid: %@", @(pid))];
        completion(error);
      }];
    }];
  };
  [buttons addSubview:_checkButton];

  _restartButton = [KBButton buttonWithText:@"Restart keybased" style:KBButtonStyleToolbar];
  _restartButton.dispatchBlock = ^(KBButton *button, KBButtonCompletion completion) {
    [gself log:@"Restarting keybased..."];
    [gself.client.installer.launchCtl reload:^(NSError *error, NSInteger pid) {
      [gself log:NSStringWithFormat(@"keybased pid:%@", @(pid))];
      completion(error);
    }];
  };
  [buttons addSubview:_restartButton];
  [self addSubview:buttons];

  // TODO logging grows forever
  _logView = [KBListView listViewWithPrototypeClass:KBLabel.class rowHeight:0];
  _logView.wantsLayer = YES;
  _logView.layer.borderColor = [KBAppearance.currentAppearance lineColor].CGColor;
  _logView.layer.borderWidth = 1.0;
  _logView.view.intercellSpacing = CGSizeMake(10, 10);
  _logView.cellSetBlock = ^(KBLabel *label, NSString *text, NSIndexPath *indexPath, NSTableColumn *tableColumn, KBListView *listView, BOOL dequeued) {
    [label setText:text style:KBTextStyleDefault];
  };
  [self addSubview:_logView];

  YOSelf yself = self;
  self.viewLayout = [YOLayout layoutWithLayoutBlock:^CGSize(id<YOLayout> layout, CGSize size) {
    CGFloat x = 10;
    CGFloat y = 10;
    y += [layout sizeToFitVerticalInFrame:CGRectMake(10, y, size.width - 20, 0) view:yself.runtimeStatusView].size.height + 10;

    y += [layout sizeToFitVerticalInFrame:CGRectMake(x, y, size.width, 34) view:buttons].size.height;

    y += [layout setFrame:CGRectMake(10, y, size.width - 20, size.height - y - 10) view:yself.logView].size.height + 10;
    return size;
  }];
}

- (void)log:(NSString *)message {
  if (message) [_logView addObjects:@[message]];
  if ([_logView isAtBottom]) [_logView scrollToBottom:YES];
}

- (void)logError:(NSError *)error {
  if (error) [_logView addObjects:@[error.localizedDescription]]; // TODO Better error display
}

- (void)appView:(KBAppView *)appView didLaunchWithClient:(KBRPClient *)client {
  NSString *version = [[NSBundle mainBundle] infoDictionary][@"CFBundleVersion"];
  [self log:NSStringWithFormat(@"Keybase.app started (%@).", version)];
  [self log:NSStringWithFormat(@"Dir: %@", [NSFileManager.defaultManager currentDirectoryPath])];
  _client = client;
  _runtimeStatusView.client = client;
  _runtimeStatusView.RPCConnected = NO;
  [_runtimeStatusView update];
  [self setNeedsLayout];
}

- (void)appView:(KBAppView *)appView didCheckInstallWithClient:(KBRPClient *)client {
  [self log:@"Install checked."];
}

- (void)appView:(KBAppView *)appView willConnectWithClient:(KBRPClient *)client {
  [self log:@"Connecting..."];
}

- (void)appView:(KBAppView *)appView didConnectWithClient:(KBRPClient *)client {
  [self log:@"Connected."];
  _runtimeStatusView.RPCConnected = YES;
  [_runtimeStatusView update];
  [self setNeedsLayout];
}

- (void)appView:(KBAppView *)appView didCheckStatusWithClient:(KBRPClient *)client config:(KBRConfig *)config status:(KBRGetCurrentStatusRes *)status {
  [self log:NSStringWithFormat(@"keybased is at %@", config.path)];
  [self log:NSStringWithFormat(@"keybased version: %@", config.version)];
  [self log:NSStringWithFormat(@"Status:\n\tconfigured: %@\n\tregistered: %@\n\tloggedIn: %@\n\tusername: %@", @(status.configured), @(status.registered), @(status.loggedIn), status.user.username ? status.user.username : @"")];
  _runtimeStatusView.config = config;
  [_runtimeStatusView update];
  [self setNeedsLayout];
}

- (void)appView:(KBAppView *)appView didLogMessage:(NSString *)message {
  [self log:message];
}

- (void)appView:(KBAppView *)appView didDisconnectWithClient:(KBRPClient *)client {
  [self log:@"Disconnected."];
  _runtimeStatusView.RPCConnected = NO;
  [_runtimeStatusView update];
  [self setNeedsLayout];
}

//- (void)showTestClientView {
//  KBTestClientView *testClientView = [[KBTestClientView alloc] init];
//  [self openInWindow:testClientView size:CGSizeMake(360, 420) title:@"Test Client"];
//}

@end
