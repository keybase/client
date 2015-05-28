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

#import "KBFSStatusView.h"
#import "KBAppView.h"
#import "KBLaunchCtl.h"
#import "KBInstallAction.h"
#import "KBLogFormatter.h"

@interface KBConsoleView () <KBComponent>
@property KBListView *logView;
@end

@implementation KBConsoleView

- (void)viewInit {
  [super viewInit];
  [self kb_setBackgroundColor:NSColor.whiteColor];

  _logFormatter = [[KBLogFormatter alloc] init];

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
  _logView.view.allowsMultipleSelection = YES;
  _logView.view.allowsEmptySelection = YES;
  _logView.cellSetBlock = ^(KBLabel *label, NSString *text, NSIndexPath *indexPath, NSTableColumn *tableColumn, KBListView *listView, BOOL dequeued) {
    [label setText:text style:KBTextStyleDefault options:KBTextOptionsMonospace|KBTextOptionsSmall alignment:NSLeftTextAlignment lineBreakMode:NSLineBreakByCharWrapping];
  };
  [self addSubview:_logView];

  self.viewLayout = [YOLayout fill:_logView];
}

- (void)logMessage:(DDLogMessage *)logMessage {
  GHWeakSelf gself = self;
  dispatch_async(dispatch_get_main_queue(), ^{
    [gself.logView addObjects:@[logMessage.message] animation:NSTableViewAnimationEffectNone];
    if ([gself.logView isAtBottom]) [gself.logView scrollToBottom:YES];
  });
}

- (NSString *)name { return @"Console"; }
- (NSString *)info { return @"Logging goes here"; }
- (NSImage *)image { return [KBIcons imageForIcon:KBIconAlertNote]; };

- (NSView *)contentView {
  return self;
}

- (void)refresh:(KBCompletion)completion { completion(nil); }

@end
