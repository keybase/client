//
//  KBConsoleView.m
//  Keybase
//
//  Created by Gabriel on 3/5/15.
//  Copyright (c) 2015 Gabriel Handford. All rights reserved.
//

#import "KBConsoleView.h"

#import "KBLogFormatter.h"
#import "KBRPC.h"
#import "KBApp.h"

@interface KBConsoleView () <KBComponent>
@property KBListView *logView;
@property KBTextView *textView;

@property NSMutableArray *buffer;
@property dispatch_queue_t bufferQueue;
@end

@interface KBConsoleItem : NSObject
@property KBTextOptions options;
@property NSString *message;
- (void)setMessage:(NSString *)message flag:(DDLogFlag)flag;
@end

#define MAX_DISPLAY_TEXT_LENGTH (4000)

@implementation KBConsoleItem

- (void)setMessage:(NSString *)message flag:(DDLogFlag)flag {
  _message = message;
  _options = KBTextOptionsMonospace|KBTextOptionsSmall;
  if (flag & DDLogFlagError) _options |= KBTextOptionsDanger;
  if (flag & DDLogFlagWarning) _options |= KBTextOptionsWarning;
}

- (NSAttributedString *)attributedString {
  return [KBText attributedStringForText:_message style:KBTextStyleDefault options:_options alignment:NSLeftTextAlignment lineBreakMode:NSLineBreakByClipping];
}

@end

@implementation KBConsoleView

- (void)viewInit {
  [super viewInit];
  [self kb_setBackgroundColor:NSColor.whiteColor];

  _buffer = [NSMutableArray array];
  _bufferQueue = dispatch_queue_create("KBConsoleLogBufferQueue", NULL);

  _logFormatter = [[KBLogConsoleFormatter alloc] init];

  YOSelf yself = self;
  YOView *logView = [YOView view];
  {
    // TODO logging grows forever
    _logView = [KBListView listViewWithRowHeight:16];
    _logView.identifier = @"log";
    _logView.scrollView.borderType = NSBezelBorder;
    _logView.view.intercellSpacing = CGSizeMake(10, 10);
    _logView.view.usesAlternatingRowBackgroundColors = YES;
    _logView.view.allowsMultipleSelection = YES;
    _logView.view.allowsEmptySelection = YES;
    _logView.onIdentifier = ^(NSIndexPath *indexPath, NSTableColumn *tableColumn, KBListView *listView) {
      return @"KBLabelCell";
    };
    _logView.onCreate = ^(NSIndexPath *indexPath, NSTableColumn *tableColumn, KBListView *listView) {
      KBLabelCell *labelCell = [[KBLabelCell alloc] init];
      labelCell.fixedHeight = 16;
      return labelCell;
    };
    _logView.onSet = ^(KBLabelCell *label, KBConsoleItem *consoleItem, NSIndexPath *indexPath, NSTableColumn *tableColumn, KBListView *listView, BOOL dequeued) {
      [label setAttributedText:[consoleItem attributedString] options:consoleItem.options];
    };
    _logView.onSelect = ^(KBTableView *tableView, KBTableSelection *selection) {
      NSArray *messages = [selection.objects map:^(KBConsoleItem * c) { return c.message; }];
      [yself.textView setText:[messages join:@"\n\n"] style:KBTextStyleDefault options:KBTextOptionsMonospace|KBTextOptionsSmall alignment:NSLeftTextAlignment lineBreakMode:NSLineBreakByCharWrapping];
    };
    [logView addSubview:_logView];

    _textView = [[KBTextView alloc] init];
    _textView.borderType = NSBezelBorder;
    _textView.identifier = @"textView";
    _textView.editable = NO;
    _textView.view.textContainerInset = CGSizeMake(5, 5);
    [logView addSubview:_textView];

    logView.viewLayout = [YOLayout layoutWithLayoutBlock:^CGSize(id<YOLayout> layout, CGSize size) {
      CGFloat y = 0;
      y += [layout setFrame:CGRectMake(0, y, size.width, size.height * 0.5) view:yself.logView].size.height;
      [layout setFrame:CGRectMake(0, y + 10, size.width, size.height - y - 10) view:yself.textView];
      return size;
    }];
  }
  [self addSubview:logView];

  YOHBox *buttons = [YOHBox box];
  {
    KBButton *clearButton = [KBButton buttonWithText:@"Clear" style:KBButtonStyleDefault options:KBButtonOptionsToolbar];
    clearButton.targetBlock = ^{ [yself clear]; };
    [buttons addSubview:clearButton];
  }
  [self addSubview:buttons];

  self.viewLayout = [YOVBorderLayout layoutWithCenter:logView top:nil bottom:@[buttons] insets:UIEdgeInsetsZero spacing:10];
}

- (void)clear {
  [self.logView removeAllObjects];
  _textView.text = nil;
}

- (void)logMessage:(DDLogMessage *)logMessage {
  GHWeakSelf gself = self;
  dispatch_async(_bufferQueue, ^{
    KBConsoleItem *consoleItem = [[KBConsoleItem alloc] init];
    NSString *message = [gself.logFormatter formatLogMessage:logMessage];

    if ([message length] > MAX_DISPLAY_TEXT_LENGTH) {
      // Truncating for performance reasons
      message = [message substringToIndex:MAX_DISPLAY_TEXT_LENGTH];
    }

    [consoleItem setMessage:message flag:logMessage.flag];
    [gself.buffer addObject:consoleItem];
    dispatch_after(dispatch_time(DISPATCH_TIME_NOW, (int64_t)(0.5 * NSEC_PER_SEC)), dispatch_get_main_queue(), ^{
      [gself flush];
    });
  });
}

- (void)flush {
  GHWeakSelf gself = self;
  dispatch_async(_bufferQueue, ^{
    NSArray *messages = [gself.buffer copy];
    [gself.buffer removeAllObjects];
    dispatch_async(dispatch_get_main_queue(), ^{
      [gself addMessages:messages];
    });
  });
}

- (void)addMessages:(NSArray *)messages {
  BOOL atBottom = [self.logView isAtBottom];
  [self.logView.dataSource addObjects:messages];
  if ([self.logView.dataSource truncateBeginning:300 max:1000 section:0]) {
    [self.logView reloadData];
  }
  //[self.logView.view noteNumberOfRowsChanged];
  [self.logView reloadData];
  if (atBottom) [self.logView scrollToBottom:NO];
}

- (NSString *)name { return @"Console"; }
- (NSString *)info { return @"Logging & messages"; }
- (NSImage *)image { return [KBIcons imageForIcon:KBIconAlertNote]; };

- (NSView *)componentView {
  return self;
}

- (void)refreshComponent:(KBRefreshComponentCompletion)completion { completion(nil); }

@end
