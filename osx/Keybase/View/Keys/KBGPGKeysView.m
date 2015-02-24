//
//  KBGPGKeysView.m
//  Keybase
//
//  Created by Gabriel on 2/17/15.
//  Copyright (c) 2015 Gabriel Handford. All rights reserved.
//

#import "KBGPGKeysView.h"

#import "KBGPGKeyView.h"
#import "KBTableRowView.h"

@interface KBGPGKeysView ()
@property NSMutableArray *dataSource;
@end

@implementation KBGPGKeysView

- (void)viewInit {
  [super viewInit];
  _dataSource = [NSMutableArray array];

  _tableView = [[NSTableView alloc] init];
  _tableView.dataSource = self;
  _tableView.delegate = self;
  _tableView.gridStyleMask = NSTableViewSolidHorizontalGridLineMask;
  _tableView.focusRingType = NSFocusRingTypeNone;

  NSTableColumn *column1 = [[NSTableColumn alloc] initWithIdentifier:@"algorithm"];
  column1.title = @"Algorithm";
  [_tableView addTableColumn:column1];
  NSTableColumn *column2 = [[NSTableColumn alloc] initWithIdentifier:@"keyID"];
  column2.title = @"Key Id";
  [_tableView addTableColumn:column2];
  NSTableColumn *column3 = [[NSTableColumn alloc] initWithIdentifier:@"expiration"];
  column3.title = @"Expiration";
  [_tableView addTableColumn:column3];
  NSTableColumn *column4 = [[NSTableColumn alloc] initWithIdentifier:@"identities"];
  column4.title = @"Email";
  [_tableView addTableColumn:column4];

  _scrollView = [[NSScrollView alloc] init];
  [_scrollView setAutoresizingMask:NSViewWidthSizable|NSViewHeightSizable];
  _scrollView.hasVerticalScroller = YES;
  _scrollView.autohidesScrollers = YES;
  [_scrollView setDocumentView:_tableView];
  [self addSubview:_scrollView];

  self.wantsLayer = YES;
  self.layer.borderColor = [KBAppearance.currentAppearance lineColor].CGColor;
  self.layer.borderWidth = 1.0;

  YOSelf yself = self;
  self.viewLayout = [YOLayout layoutWithLayoutBlock:^CGSize(id<YOLayout> layout, CGSize size) {
    [layout setSize:size view:yself.scrollView options:0];

    // TODO: Move this into after first layout
    if (![layout isSizing]) [yself.tableView scrollPoint:NSMakePoint(0, -yself.tableView.headerView.frame.size.height)];

    return size;
  }];
}

- (void)setGPGKeys:(NSArray */*of KBRGPGKey*/)GPGKeys {
  [_dataSource addObjectsFromArray:GPGKeys];
  [_tableView reloadData];
}

- (BOOL)tableView:(NSTableView *)aTableView shouldEditTableColumn:(NSTableColumn *)aTableColumn row:(NSInteger)rowIndex {
  return NO;
}

- (id)tableView:(NSTableView *)tableView objectValueForTableColumn:(NSTableColumn *)tableColumn row:(NSInteger)row {
  if ([tableColumn.identifier isEqualTo:@"algorithm"]) {
    return [_dataSource[row] algorithm];
  } else if ([tableColumn.identifier isEqualTo:@"keyID"]) {
    return [_dataSource[row] keyID];
  } else if ([tableColumn.identifier isEqualTo:@"expiration"]) {
    return [_dataSource[row] expiration];
  } else if ([tableColumn.identifier isEqualTo:@"identities"]) {
    return [[_dataSource[row] identities] join:@", "];
  }
  return nil;
}

- (NSInteger)numberOfRowsInTableView:(NSTableView *)tableView {
  return [_dataSource count];
}

- (KBRGPGKey *)selectedGPGKey {
  NSInteger selectedRow = [_tableView selectedRow];
  if (selectedRow < 0) return nil;
  return _dataSource[selectedRow];
}

- (void)tableViewSelectionDidChange:(NSNotification *)notification {
  //[self.delegate GPGKeysView:self didSelectGPGKey:[notification object]];
}

@end