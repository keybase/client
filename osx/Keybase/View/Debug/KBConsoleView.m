//
//  KBConsoleView.m
//  Keybase
//
//  Created by Gabriel on 3/5/15.
//  Copyright (c) 2015 Gabriel Handford. All rights reserved.
//

#import "KBConsoleView.h"

#import "AppDelegate.h"
#import "KBLaunchCtl.h"
#import "KBAppKit.h"

#import "KBMockViews.h"
#import "KBTestClientView.h"
#import "KBTestHelperView.h"

@interface KBConsoleView ()
@property KBRuntimeStatusView *runtimeStatusView;
@property KBListView *logView;

@property KBRPClient *client;

@property KBButton *toggleButton;
@end

@implementation KBConsoleView

- (void)viewInit {
  [super viewInit];
  [self kb_setBackgroundColor:NSColor.whiteColor];

  _runtimeStatusView = [[KBRuntimeStatusView alloc] init];
  [self addSubview:_runtimeStatusView];

  YOHBox *buttons = [YOHBox box:@{@"spacing": @"10", @"insets": @"0,0,10,0"}];
  [self addSubview:buttons];
  GHWeakSelf gself = self;
  KBButton *checkButton = [KBButton buttonWithText:@"Status" style:KBButtonStyleToolbar];
  checkButton.dispatchBlock = ^(KBButton *button, KBButtonCompletion completion) {
    [AppDelegate.appView checkStatus:^(NSError *error) {
      [gself.client.installer.launchCtl status:^(NSError *error, NSInteger pid) {
        [gself log:NSStringWithFormat(@"keybased (launchctl) pid: %@", @(pid))];
        completion(error);
      }];
    }];
  };
  [buttons addSubview:checkButton];

  _toggleButton = [KBButton buttonWithText:@"Start keybased" style:KBButtonStyleToolbar];
  _toggleButton.dispatchBlock = ^(KBButton *button, KBButtonCompletion completion) {
    [gself.client.installer.launchCtl reload:^(NSError *error, NSInteger pid) {
      [gself log:NSStringWithFormat(@"keybased (launchctl) pid: %@", @(pid))];
      completion(error);
    }];
  };
  [buttons addSubview:_toggleButton];

  KBButton *debugButton = [KBButton buttonWithText:@"Debug" style:KBButtonStyleToolbar];
  debugButton.targetBlock = ^{
    KBMockViews *mockViews = [[KBMockViews alloc] init];
    [self.window kb_addChildWindowForView:mockViews rect:CGRectMake(0, 0, 400, 500) position:KBWindowPositionCenter title:@"Debug" fixed:NO errorHandler:nil];
  };
  [buttons addSubview:debugButton];

  KBButton *helperButton = [KBButton buttonWithText:@"Helper" style:KBButtonStyleToolbar];
  helperButton.targetBlock = ^{
    KBTestHelperView *view = [[KBTestHelperView alloc] init];
    [self.window kb_addChildWindowForView:view rect:CGRectMake(0, 0, 400, 500) position:KBWindowPositionCenter title:@"Helper" fixed:NO errorHandler:nil];
  };
  [buttons addSubview:helperButton];

  // TODO logging grows forever
  _logView = [KBListView listViewWithPrototypeClass:KBLabel.class rowHeight:0];
  _logView.scrollView.borderType = NSBezelBorder;
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

  [NSNotificationCenter.defaultCenter addObserver:self selector:@selector(update:) name:KBStatusDidChangeNotification object:nil];
}

- (void)dealloc {
  [NSNotificationCenter.defaultCenter removeObserver:self];
}

- (void)update:(NSNotification *)notification {
  KBRGetCurrentStatusRes *status = notification.userInfo[@"status"];
  GHWeakSelf gself = self;
  if (status) {
    [_toggleButton setText:@"Stop keybased" style:KBButtonStyleToolbar alignment:NSCenterTextAlignment lineBreakMode:NSLineBreakByClipping];
    _toggleButton.dispatchBlock = ^(KBButton *button, KBButtonCompletion completion) {
      [gself.client.installer.launchCtl unload:YES completion:^(NSError *error, NSString *output) {
        completion(error);
      }];
    };
  } else {
    [_toggleButton setText:@"Start keybased" style:KBButtonStyleToolbar alignment:NSCenterTextAlignment lineBreakMode:NSLineBreakByClipping];
    _toggleButton.dispatchBlock = ^(KBButton *button, KBButtonCompletion completion) {
      [gself.client.installer.launchCtl load:YES completion:^(NSError *error, NSString *output) {
        completion(error);
      }];
    };
  }

#ifdef DEBUG
  // In debug we aren't using launch services to run keybased
  _toggleButton.targetBlock = ^{
    KBDebugAlert(@"keybased isn't using launch services in DEBUG", gself.window);
  };
#endif
}

- (void)log:(NSString *)message {
  if (message) [_logView addObjects:@[message]];
  if ([_logView isAtBottom]) [_logView scrollToBottom:YES];
}

- (void)logError:(NSError *)error {
  if (error) [_logView addObjects:@[error.localizedDescription]]; // TODO Better error display
}

- (void)appViewDidLaunch:(KBAppView *)appView {
  NSString *version = [[NSBundle mainBundle] infoDictionary][@"CFBundleVersion"];
  [self log:NSStringWithFormat(@"Keybase.app started (%@).", version)];
  //[self log:NSStringWithFormat(@"Dir: %@", [NSFileManager.defaultManager currentDirectoryPath])];
  //[self log:NSStringWithFormat(@"Executable: %@", NSBundle.mainBundle.executablePath)];
  NSString *KBKeybasedVersion = [[NSBundle mainBundle] infoDictionary][@"KBKeybasedVersion"];
  [self log:NSStringWithFormat(@"Info (keybased): %@", KBKeybasedVersion)];
  _client = appView.client;
  _runtimeStatusView.client = appView.client;
  _runtimeStatusView.RPCConnected = NO;
  [_runtimeStatusView update];
  [self setNeedsLayout];
}

- (void)appView:(KBAppView *)appView didCheckInstall:(BOOL)installed installType:(KBInstallType)installType {
  if (installed) {
    [self log:@"Installed."];
  } else {
    [self log:@"Install checked."];
  }
}

- (void)appView:(KBAppView *)appView didErrorOnInstall:(NSError *)error {
  [self log:NSStringWithFormat(@"Install error: %@", error)];
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

- (void)appView:(KBAppView *)appView didCheckStatusWithConfig:(KBRConfig *)config status:(KBRGetCurrentStatusRes *)status {
  [self log:NSStringWithFormat(@"keybased config:%@", [config propertiesDescription:@"\n\t"])];

  [self log:NSStringWithFormat(@"Status:\n\tconfigured: %@\n\tregistered: %@\n\tloggedIn: %@\n\tusername: %@", @(status.configured), @(status.registered), @(status.loggedIn), status.user.username ? status.user.username : @"")];
  _runtimeStatusView.config = config;
  [_runtimeStatusView update];
  [self setNeedsLayout];
}

- (void)appView:(KBAppView *)appView didLogMessage:(NSString *)message {
  [self log:message];
}

- (void)appView:(KBAppView *)appView didErrorOnConnect:(NSError *)error connectAttempt:(NSInteger)connectAttempt {
  [self log:NSStringWithFormat(@"Failed to connect (%@): %@", @(connectAttempt), [error localizedDescription])];
}

- (void)appView:(KBAppView *)appView didDisconnectWithClient:(KBRPClient *)client {
  [self log:@"Disconnected."];
  _runtimeStatusView.RPCConnected = NO;
  [_runtimeStatusView update];
  [self setNeedsLayout];
}

- (void)appViewDidUpdateStatus:(KBAppView *)appView {
  //[self log:@"Updated status."];
}

@end
