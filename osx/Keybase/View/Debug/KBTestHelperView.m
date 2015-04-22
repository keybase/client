//
//  KBTestHelperView.m
//  Keybase
//
//  Created by Gabriel on 4/17/15.
//  Copyright (c) 2015 Gabriel Handford. All rights reserved.
//

#import "KBTestHelperView.h"

#import "AppDelegate.h"

@interface KBTestHelperView ()
@property KBButton *installButton;
@property KBListView *logView;
@end

@implementation KBTestHelperView

- (void)viewInit {
  [super viewInit];

  GHWeakSelf gself = self;
  YOHBox *buttons = [YOHBox box:@{@"spacing": @"10", @"insets": @"0,20,10,0"}];
  [self addSubview:buttons];
  KBButton *installButton = [KBButton buttonWithText:@"Install" style:KBButtonStyleToolbar];
  installButton.targetBlock = ^{ [gself install]; };
  [buttons addSubview:installButton];

  KBButton *connectButton = [KBButton buttonWithText:@"Connect" style:KBButtonStyleToolbar];
  connectButton.targetBlock = ^{ [gself connect]; };
  [buttons addSubview:connectButton];

  KBButton *checkButton = [KBButton buttonWithText:@"Version" style:KBButtonStyleToolbar];
  checkButton.targetBlock = ^{ [gself checkVersion]; };
  [buttons addSubview:checkButton];

  KBButton *installKBFSButton = [KBButton buttonWithText:@"Install KBFS" style:KBButtonStyleToolbar];
  installKBFSButton.targetBlock = ^{ [gself installKBFS]; };
  [buttons addSubview:installKBFSButton];

  _logView = [KBListView listViewWithPrototypeClass:KBLabel.class rowHeight:0];
  _logView.scrollView.borderType = NSBezelBorder;
  _logView.view.intercellSpacing = CGSizeMake(10, 10);
  _logView.cellSetBlock = ^(KBLabel *label, NSString *text, NSIndexPath *indexPath, NSTableColumn *tableColumn, KBListView *listView, BOOL dequeued) {
    [label setText:text style:KBTextStyleDefault];
  };
  [self addSubview:_logView];

  YOSelf yself = self;
  self.viewLayout = [YOLayout layoutWithLayoutBlock:^CGSize(id<YOLayout> layout, CGSize size) {
    CGFloat y = 20;
    y += [layout sizeToFitVerticalInFrame:CGRectMake(0, y, size.width, 34) view:buttons].size.height;

    [layout setFrame:CGRectMake(20, y, size.width - 40, size.height - y - 20) view:yself.logView];

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

- (void)install {
  NSAssert(AppDelegate.sharedDelegate.helper, @"No helper");
  NSError *error = nil;
  if (![AppDelegate.sharedDelegate.helper install:&error]) {
    if (error) {
      [self logError:error];
    } else {
      [self log:@"Install failed without error"];
    }
  } else {
    [self log:@"Installed"];
  }
}

- (void)connect {
  NSAssert(AppDelegate.sharedDelegate.helper, @"No helper");
  NSError *error = nil;
  if (![AppDelegate.sharedDelegate.helper connect:&error]) {
    if (error) {
      [self logError:error];
    } else {
      [self log:@"Install failed without error"];
    }
  } else {
    [self log:@"Connected"];
  }
}

- (void)checkVersion {
  NSAssert(AppDelegate.sharedDelegate.helper, @"No helper");
  [AppDelegate.sharedDelegate.helper sendRequest:@"version" params:nil completion:^(NSError *error, NSString *version) {
    if (error) {
      [self logError:error];
    } else {
      [self log:NSStringWithFormat(@"Version: %@", version)];
    }
  }];
}

- (void)installKBFS {
  NSAssert(AppDelegate.sharedDelegate.helper, @"No helper");

  NSString *path = [NSBundle.mainBundle pathForResource:@"osxfusefs.fs" ofType:@"bundle"];
  NSAssert(path, @"Missing osxfusefs");
  [AppDelegate.sharedDelegate.helper sendRequest:@"installKBFS" params:@[@{@"path": path}] completion:^(NSError *error, id value) {
    if (error) {
      [self logError:error];
    } else {
      [self log:NSStringWithFormat(@"Install KBFS: %@", value)];
    }
  }];
}

/*
- (void)test {
  KBHelperClient *helperClient = [[KBHelperClient alloc] init];
  KBHelper *helper = [[KBHelper alloc] init];

  xpc_object_t event = [helperClient XPCObjectForRequestWithMethod:@"version" params:nil error:nil];
  [helper handleEvent:event completion:^(NSError *error, NSData *data) {
    NSArray *response = [helperClient responseForData:data error:nil];
    DDLogDebug(@"Response: %@", response);
    NSAssert(response, @"No response");
  }];
}
 */

@end

