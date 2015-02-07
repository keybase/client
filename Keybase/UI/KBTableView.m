//
//  KBTableView.m
//  Keybase
//
//  Created by Gabriel on 2/2/15.
//  Copyright (c) 2015 Gabriel Handford. All rights reserved.
//

#import "KBTableView.h"

#import "KBUserView.h"
#import "AppDelegate.h"
#import "KBUserProfileView.h"
#import "KBTableRowView.h"

@interface KBTableView ()
@property NSScrollView *scrollView;
@property NSTableView *tableView;
@property NSMutableArray *dataSource;

@property YONSView *prototypeView;
@end


@implementation KBTableView

- (void)viewInit {
  [super viewInit];
  _dataSource = [NSMutableArray array];

  _tableView = [[NSTableView alloc] init];
  _tableView.dataSource = self;
  _tableView.delegate = self;
  _tableView.intercellSpacing = CGSizeZero;
  //_tableView.gridStyleMask = NSTableViewSolidHorizontalGridLineMask;
  [_tableView setHeaderView:nil];

  NSTableColumn *column1 = [[NSTableColumn alloc] initWithIdentifier:@""];
  [_tableView addTableColumn:column1];

  _scrollView = [[NSScrollView alloc] init];
  [_scrollView setHasVerticalScroller:YES];
  [_scrollView setAutoresizingMask:NSViewWidthSizable|NSViewHeightSizable];
  [_scrollView setDocumentView:_tableView];
  [self addSubview:_scrollView];

  YOSelf yself = self;
  self.viewLayout = [YOLayout layoutWithLayoutBlock:^(id<YOLayout> layout, CGSize size) {
    [layout setSize:size view:yself.scrollView options:0];
    return size;
  }];
}

- (void)setObjects:(NSArray *)objects {
  [_dataSource removeAllObjects];
  if (objects) [_dataSource addObjectsFromArray:objects];
  [_tableView reloadData];
}

- (NSInteger)numberOfRowsInTableView:(NSTableView *)tableView {
  return [_dataSource count];
}

- (NSTableRowView *)tableView:(NSTableView *)tableView rowViewForRow:(NSInteger)row {
  KBTableRowView *rowView = [[KBTableRowView alloc] init];
  GHDebug(@"row: %@", @(row));
  return rowView;
}

- (void)updateView:(YONSView *)view object:(id)object {
  // Abstract
}

- (void)select:(id)object {
  // Abstract
}

- (void)deselectAll {
  [_tableView deselectAll:nil];
}

- (NSView *)tableView:(NSTableView *)tableView viewForTableColumn:(NSTableColumn *)tableColumn row:(NSInteger)row {
  id object = [_dataSource objectAtIndex:row];
  YONSView *view = [_tableView makeViewWithIdentifier:NSStringFromClass(_prototypeClass) owner:self];
  if (!view) {
    view = [[_prototypeClass alloc] init];
    view.identifier = NSStringFromClass(_prototypeClass);
  }

  [self updateView:view object:object];
  [view setNeedsLayout];

  return view;
}

- (CGFloat)tableView:(NSTableView *)tableView heightOfRow:(NSInteger)row {
  if (!_prototypeView) _prototypeView = [[_prototypeClass alloc] init];
  id object = [_dataSource objectAtIndex:row];

  [self updateView:_prototypeView object:object];
  [_prototypeView setNeedsLayout];

  return [_prototypeView sizeThatFits:tableView.frame.size].height;
}

- (void)tableViewSelectionDidChange:(NSNotification *)notification {
  NSInteger selectedRow = [_tableView selectedRow];
  if (selectedRow >= 0) {
    NSTableRowView *rowView = [_tableView rowViewAtRow:selectedRow makeIfNecessary:NO];
    [rowView setEmphasized:NO];
    id object = [_dataSource objectAtIndex:selectedRow];
    [self select:object];
  }
}

@end

