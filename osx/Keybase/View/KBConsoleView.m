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
@property KBDebugStatusView *debugStatusView;
@property KBButton *checkButton;
@property KBListView *logView;

@property KBRPClient *client;
@end

@implementation KBConsoleView

- (void)viewInit {
  [super viewInit];

  _debugStatusView = [[KBDebugStatusView alloc] init];
  [self addSubview:_debugStatusView];

  GHWeakSelf gself = self;
  _checkButton = [KBButton buttonWithText:@"Check" style:KBButtonStyleToolbar];
  _checkButton.actionBlock = ^(id sender) { [gself check]; };
  [self addSubview:_checkButton];

  // TODO logging grows forever
  _logView = [KBListView listViewWithPrototypeClass:KBLabel.class rowHeight:0];
  _logView.wantsLayer = YES;
  _logView.layer.borderColor = [KBAppearance.currentAppearance lineColor].CGColor;
  _logView.layer.borderWidth = 1.0;
  _logView.view.intercellSpacing = CGSizeMake(10, 10);
  _logView.cellSetBlock = ^(KBLabel *label, NSString *text, NSIndexPath *indexPath, NSTableColumn *tableColumn, NSTableView *tableView, BOOL dequeued) {
    [label setText:text style:KBLabelStyleDefault];
  };
  [self addSubview:_logView];

  YOSelf yself = self;
  self.viewLayout = [YOLayout layoutWithLayoutBlock:^CGSize(id<YOLayout> layout, CGSize size) {
    CGFloat x = 10;
    CGFloat y = 10;
    y += [layout sizeToFitVerticalInFrame:CGRectMake(10, y, size.width - 20, 0) view:yself.debugStatusView].size.height + 10;

    x += [layout setFrame:CGRectMake(x, y, 80, 24) view:yself.checkButton].size.width + 10;

    y += 34;
    y += [layout setFrame:CGRectMake(10, y, size.width - 20, size.height - y - 10) view:yself.logView].size.height + 10;
    return size;
  }];
}

- (void)check {
  _checkButton.enabled = NO;
  GHWeakSelf gself = self;
  [AppDelegate.appView checkStatus:^{
    [gself.client.installer.launchCtl status:^(NSError *error, NSString *output) {
      [self log:output];
    }];
    gself.checkButton.enabled = YES;
  }];
}

- (void)log:(NSString *)message {
  if (message) [_logView addObjects:@[message]];
}

- (void)appView:(KBAppView *)appView didLaunchWithClient:(KBRPClient *)client {
  [self log:@"App started."];
  _client = client;
  _debugStatusView.client = client;
  [_debugStatusView setRPCConnected:NO serverConnected:NO];
  [self setNeedsLayout];
}

- (void)appView:(KBAppView *)appView didCheckInstallWithClient:(KBRPClient *)client {
  [self log:@"Install checked."];
}

- (void)appView:(KBAppView *)appView willConnectWithClient:(KBRPClient *)client {
  [self log:@"Connecting..."];
  [self setNeedsLayout];
}

- (void)appView:(KBAppView *)appView didConnectWithClient:(KBRPClient *)client {
  [self log:@"Connected."];
  [_debugStatusView setRPCConnected:YES serverConnected:NO];
  [self setNeedsLayout];
}

- (void)appView:(KBAppView *)appView didCheckStatusWithClient:(KBRPClient *)client config:(KBRConfig *)config status:(KBRGetCurrentStatusRes *)status {
  [self log:@"Checked status."];
  _debugStatusView.config = config;
  [_debugStatusView setRPCConnected:YES serverConnected:YES]; // TODO server connected status
  [self setNeedsLayout];
}

- (void)appView:(KBAppView *)appView didLogMessage:(NSString *)message {
  [self log:message];
}

- (void)appView:(KBAppView *)appView didDisconnectWithClient:(KBRPClient *)client {
  [self log:@"Disconnected."];
  [_debugStatusView setRPCConnected:NO serverConnected:NO];
  [self setNeedsLayout];
}

//- (void)showTestClientView {
//  KBTestClientView *testClientView = [[KBTestClientView alloc] init];
//  [self openInWindow:testClientView size:CGSizeMake(360, 420) title:@"Test Client"];
//}

@end
