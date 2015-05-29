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
@property KBTextView *textView;
@end

@implementation KBConsoleView

- (void)viewInit {
  [super viewInit];
  [self kb_setBackgroundColor:NSColor.whiteColor];

  _logFormatter = [[KBLogFormatter alloc] init];

  /*
  KBButton *clearButton = [KBButton buttonWithText:@"Clear" style:KBButtonStyleDefault options:KBButtonOptionsToolbar];
  clearButton.targetBlock = ^{
    [gself.logView removeAllObjects];
  };
  [buttons addSubview:clearButton];
   */

  GHWeakSelf gself = self;
  // TODO logging grows forever
  _logView = [KBListView listViewWithPrototypeClass:KBLabel.class rowHeight:16];
  _logView.identifier = @"log";
  _logView.scrollView.borderType = NSBezelBorder;
  _logView.view.intercellSpacing = CGSizeMake(10, 10);
  _logView.view.usesAlternatingRowBackgroundColors = YES;
  _logView.view.allowsMultipleSelection = YES;
  _logView.view.allowsEmptySelection = YES;
  _logView.cellSetBlock = ^(KBLabel *label, NSString *text, NSIndexPath *indexPath, NSTableColumn *tableColumn, KBListView *listView, BOOL dequeued) {
    [label setText:text style:KBTextStyleDefault options:KBTextOptionsMonospace|KBTextOptionsSmall alignment:NSLeftTextAlignment lineBreakMode:NSLineBreakByClipping];
  };
  _logView.onSelect = ^(KBTableView *tableView, KBTableSelection *selection) {
    [gself.textView setText:[selection.objects join:@"\n\n"] style:KBTextStyleDefault options:KBTextOptionsMonospace|KBTextOptionsSmall alignment:NSLeftTextAlignment lineBreakMode:NSLineBreakByCharWrapping];
  };
  [self addSubview:_logView];

  _textView = [[KBTextView alloc] init];
  _textView.borderType = NSBezelBorder;
  _textView.identifier = @"textView";
  _textView.view.textContainerInset = CGSizeMake(5, 5);
  [self addSubview:_textView];

  //self.options = @{@"log": @{@"height": @"50%"}, @"textView": @{@"height": @"50%"}};

  YOSelf yself = self;
  self.viewLayout = [YOLayout layoutWithLayoutBlock:^CGSize(id<YOLayout> layout, CGSize size) {
    CGFloat y = 0;
    y += [layout setFrame:CGRectMake(0, y, size.width, size.height * 0.5) view:yself.logView].size.height;
    [layout setFrame:CGRectMake(0, y + 10, size.width, size.height - y - 10) view:yself.textView];
    return size;
  }];
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
