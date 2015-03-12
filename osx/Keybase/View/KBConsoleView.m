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

@interface KBConsoleView ()
@property KBListView *logView;
@property KBDebugStatusView *debugStatusView;
@end

@implementation KBConsoleView

- (void)viewInit {
  [super viewInit];

  _debugStatusView = [[KBDebugStatusView alloc] init];
  [self addSubview:_debugStatusView];

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
    CGFloat y = 10;
    y += [layout sizeToFitVerticalInFrame:CGRectMake(10, y, size.width - 20, 0) view:yself.debugStatusView].size.height + 10;
    y += [layout setFrame:CGRectMake(10, y, size.width - 20, size.height - y - 10) view:yself.logView].size.height + 10;
    return size;
  }];
}

- (void)log:(NSString *)message {
  [_logView addObjects:@[message]];
}

//- (void)showTestClientView {
//  KBTestClientView *testClientView = [[KBTestClientView alloc] init];
//  [self openInWindow:testClientView size:CGSizeMake(360, 420) title:@"Test Client"];
//}

@end
