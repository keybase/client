//
//  KBConsoleView.m
//  Keybase
//
//  Created by Gabriel on 3/5/15.
//  Copyright (c) 2015 Gabriel Handford. All rights reserved.
//

#import "KBConsoleView.h"

#import "KBLaunchService.h"
#import "KBAppDefines.h"

#import "KBFSStatusView.h"
#import "KBAppView.h"
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

  _logFormatter = [[KBLogConsoleFormatter alloc] init];

  YOView *logView = [YOView view];
  [self addSubview:logView];

  GHWeakSelf gself = self;
  // TODO logging grows forever
  _logView = [KBListView listViewWithPrototypeClass:KBLabel.class rowHeight:16];
  _logView.identifier = @"log";
  _logView.scrollView.borderType = NSBezelBorder;
  _logView.view.intercellSpacing = CGSizeMake(10, 10);
  _logView.view.usesAlternatingRowBackgroundColors = YES;
  _logView.view.allowsMultipleSelection = YES;
  _logView.view.allowsEmptySelection = YES;
  _logView.cellSetBlock = ^(KBLabel *label, DDLogMessage *logMessage, NSIndexPath *indexPath, NSTableColumn *tableColumn, KBListView *listView, BOOL dequeued) {

    NSString *message = [gself.logFormatter formatLogMessage:logMessage];

    KBTextOptions options = KBTextOptionsMonospace|KBTextOptionsSmall;
    if (logMessage.flag & DDLogFlagError) options |= KBTextOptionsDanger;
    if (logMessage.flag & DDLogFlagWarning) options |= KBTextOptionsWarning;

    [label setText:message style:KBTextStyleDefault options:options alignment:NSLeftTextAlignment lineBreakMode:NSLineBreakByClipping];
  };
  _logView.onSelect = ^(KBTableView *tableView, KBTableSelection *selection) {
    NSArray *messages = [selection.objects map:^(DDLogMessage *m) { return m.message; }];
    [gself.textView setText:[messages join:@"\n\n"] style:KBTextStyleDefault options:KBTextOptionsMonospace|KBTextOptionsSmall alignment:NSLeftTextAlignment lineBreakMode:NSLineBreakByCharWrapping];
  };
  [logView addSubview:_logView];

  _textView = [[KBTextView alloc] init];
  _textView.borderType = NSBezelBorder;
  _textView.identifier = @"textView";
  _textView.view.textContainerInset = CGSizeMake(5, 5);
  [logView addSubview:_textView];

  YOHBox *buttons = [YOHBox box];
  [self addSubview:buttons];
  KBButton *clearButton = [KBButton buttonWithText:@"Clear" style:KBButtonStyleDefault options:KBButtonOptionsToolbar];
  clearButton.targetBlock = ^{ [gself clear]; };
  [buttons addSubview:clearButton];

  YOSelf yself = self;
  logView.viewLayout = [YOLayout layoutWithLayoutBlock:^CGSize(id<YOLayout> layout, CGSize size) {
    CGFloat y = 0;
    y += [layout setFrame:CGRectMake(0, y, size.width, size.height * 0.5) view:yself.logView].size.height;
    [layout setFrame:CGRectMake(0, y + 10, size.width, size.height - y - 10) view:yself.textView];
    return size;
  }];

  self.viewLayout = [YOBorderLayout layoutWithCenter:logView top:nil bottom:@[buttons] insets:UIEdgeInsetsZero spacing:10];
}

- (void)clear {
  [self.logView removeAllObjects];
  _textView.text = nil;
}

- (void)logMessage:(DDLogMessage *)logMessage {
  GHWeakSelf gself = self;
  dispatch_async(dispatch_get_main_queue(), ^{
    [gself.logView addObjects:@[logMessage] animation:NSTableViewAnimationEffectNone];
    if ([gself.logView isAtBottom]) [gself.logView scrollToBottom:YES];
  });
}

- (NSString *)name { return @"Console"; }
- (NSString *)info { return @"Logging & messages"; }
- (NSImage *)image { return [KBIcons imageForIcon:KBIconAlertNote]; };

- (NSView *)componentView {
  return self;
}

- (void)refreshComponent:(KBCompletion)completion { completion(nil); }

@end
