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

@interface KBConsoleView () <KBAppViewDelegate, KBComponent>
@property KBListView *logView;
@property KBRPClient *client;
@end

@implementation KBConsoleView

- (void)viewInit {
  [super viewInit];
  [self kb_setBackgroundColor:NSColor.whiteColor];

  /*
  KBButton *clearButton = [KBButton buttonWithText:@"Clear" style:KBButtonStyleToolbar];
  clearButton.targetBlock = ^{
    [gself.logView removeAllObjects];
  };
  [buttons addSubview:clearButton];
   */

  // TODO logging grows forever
  _logView = [KBListView listViewWithPrototypeClass:KBLabel.class rowHeight:0];
  _logView.scrollView.borderType = NSBezelBorder;
  _logView.view.intercellSpacing = CGSizeMake(10, 10);
  _logView.cellSetBlock = ^(KBLabel *label, NSString *text, NSIndexPath *indexPath, NSTableColumn *tableColumn, KBListView *listView, BOOL dequeued) {
    [label setText:text style:KBTextStyleDefault];
  };
  [self addSubview:_logView];

  self.viewLayout = [YOLayout fill:_logView];
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
  KBConsoleLog(@"Keybase.app Version: %@", info[@"CFBundleShortVersionString"]);

  _client = appView.service.client;
  [self setNeedsLayout];
}

- (void)appView:(KBAppView *)appView willConnectWithClient:(KBRPClient *)client {
  KBConsoleLog(@"Connecting...");
}

- (void)appView:(KBAppView *)appView didConnectWithClient:(KBRPClient *)client {
  KBConsoleLog(@"Connected.");
}

- (void)appView:(KBAppView *)appView didCheckStatusWithConfig:(KBRConfig *)config status:(KBRGetCurrentStatusRes *)currentStatus { }

- (void)appView:(KBAppView *)appView didLogMessage:(NSString *)message {
  KBConsoleLog(@"%@", message);
}

- (void)appView:(KBAppView *)appView didErrorOnConnect:(NSError *)error connectAttempt:(NSInteger)connectAttempt {
  KBConsoleLog(@"Failed to connect (%@): %@", @(connectAttempt), [error localizedDescription]);
}

- (void)appView:(KBAppView *)appView didDisconnectWithClient:(KBRPClient *)client {
  KBConsoleLog(@"Disconnected.");
}

- (void)appViewDidUpdateStatus:(KBAppView *)appView {
  //KBConsoleLog(@"Updated status.");
}

- (NSString *)name { return @"Console"; }
- (NSString *)info { return @"Logging goes here"; }
- (NSImage *)image { return [KBIcons imageForIcon:KBIconAlertNote]; };

- (NSView *)contentView {
  return self;
}

- (void)refresh:(KBCompletion)completion { completion(nil); }

@end
