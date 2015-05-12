//
//  KBConsoleView.m
//  Keybase
//
//  Created by Gabriel on 3/5/15.
//  Copyright (c) 2015 Gabriel Handford. All rights reserved.
//

#import "KBConsoleView.h"

#import "AppDelegate.h"
#import "KBLaunchService.h"
#import "KBAppKit.h"

#import "KBMockViews.h"
#import "KBTestClientView.h"
#import "KBFSStatusView.h"
#import "KBAppView.h"
#import "KBLaunchCtl.h"
#import "KBInstallAction.h"

@interface KBConsoleView () <KBAppViewDelegate>
@property KBListView *logView;
@property KBRPClient *client;
@end

@implementation KBConsoleView

- (void)viewInit {
  [super viewInit];
  [self kb_setBackgroundColor:NSColor.whiteColor];

  YOHBox *buttons = [YOHBox box:@{@"spacing": @"10", @"insets": @"0,0,10,0"}];
  [self addSubview:buttons];
  GHWeakSelf gself = self;
  KBButton *checkButton = [KBButton buttonWithText:@"Status" style:KBButtonStyleToolbar];
  checkButton.dispatchBlock = ^(KBButton *button, KBButtonCompletion completion) {
    [AppDelegate.appView checkStatus:^(NSError *error) {
      if (gself.client.environment.launchdLabelService) {
        [KBLaunchCtl status:gself.client.environment.launchdLabelService completion:^(KBServiceStatus *status) {
          KBConsoleLog(@"Keybase (launchctl): %@", status);
          completion(error);
        }];
      } else {
        completion(error);
      }
    }];
  };
  [buttons addSubview:checkButton];

  KBButton *debugButton = [KBButton buttonWithText:@"Views" style:KBButtonStyleToolbar];
  debugButton.targetBlock = ^{
    KBMockViews *mockViews = [[KBMockViews alloc] init];
    [self.window kb_addChildWindowForView:mockViews rect:CGRectMake(0, 0, 400, 500) position:KBWindowPositionCenter title:@"Debug" fixed:NO makeKey:YES];
  };
  [buttons addSubview:debugButton];

  KBButton *helperButton = [KBButton buttonWithText:@"Helper" style:KBButtonStyleToolbar];
  helperButton.targetBlock = ^{
    KBFSStatusView *view = [[KBFSStatusView alloc] init];
    [self.window kb_addChildWindowForView:view rect:CGRectMake(0, 0, 400, 300) position:KBWindowPositionCenter title:@"Helper" fixed:NO makeKey:YES];
  };
  [buttons addSubview:helperButton];

  KBButton *clearButton = [KBButton buttonWithText:@"Clear" style:KBButtonStyleToolbar];
  clearButton.targetBlock = ^{
    [gself.logView removeAllObjects];
  };
  [buttons addSubview:clearButton];

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
    y += [layout sizeToFitVerticalInFrame:CGRectMake(x, y, size.width, 34) view:buttons].size.height;

    y += [layout setFrame:CGRectMake(10, y, size.width - 20, size.height - y - 10) view:yself.logView].size.height + 10;
    return size;
  }];
}

- (void)log:(NSString *)message {
  if (message) [_logView addObjects:@[message] animation:NSTableViewAnimationEffectNone];
  if ([_logView isAtBottom]) [_logView scrollToBottom:YES];
}

- (void)logError:(NSError *)error {
  if (error) [self log:NSStringWithFormat(@"%@", error)];
}

- (void)appViewDidLaunch:(KBAppView *)appView {
  NSDictionary *info = [[NSBundle mainBundle] infoDictionary];
  KBConsoleLog(@"Keybase.app Version: %@ (%@)", info[@"CFBundleVersion"], info[@"CFBundleShortVersionString"]);  

  _client = appView.client;
  [self setNeedsLayout];
}

- (void)appView:(KBAppView *)appView willConnectWithClient:(KBRPClient *)client {
  KBConsoleLog(@"Connecting...");
}

- (void)appView:(KBAppView *)appView didConnectWithClient:(KBRPClient *)client {
  KBConsoleLog(@"Connected.");
}

- (void)appView:(KBAppView *)appView didCheckStatusWithConfig:(KBRConfig *)config status:(KBRGetCurrentStatusRes *)status {
  KBConsoleLog(@"Keybase config:%@", [config propertiesDescription:@"\n\t"]);
  KBConsoleLog(@"Status:\n\tconfigured: %@\n\tregistered: %@\n\tloggedIn: %@\n\tusername: %@", @(status.configured), @(status.registered), @(status.loggedIn), status.user.username ? status.user.username : @"");
  [self setNeedsLayout];
}

- (void)appView:(KBAppView *)appView didLogMessage:(NSString *)message {
  KBConsoleLog(@"%@", message);
}

- (void)appView:(KBAppView *)appView didErrorOnConnect:(NSError *)error connectAttempt:(NSInteger)connectAttempt {
  KBConsoleLog(@"Failed to connect (%@): %@", @(connectAttempt), [error localizedDescription]);
}

- (void)appView:(KBAppView *)appView didDisconnectWithClient:(KBRPClient *)client {
  KBConsoleLog(@"Disconnected.");
  [self setNeedsLayout];
}

- (void)appViewDidUpdateStatus:(KBAppView *)appView {
  //KBConsoleLog(@"Updated status.");
}

@end
