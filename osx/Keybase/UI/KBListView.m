//
//  KBListView.m
//  Keybase
//
//  Created by Gabriel on 2/2/15.
//  Copyright (c) 2015 Gabriel Handford. All rights reserved.
//

#import "KBListView.h"

#import "KBAppearance.h"
#import "KBScrollView.h"

@interface KBListView ()
@property KBScrollView *scrollView;
@property NSTableView *tableView;
@property NSMutableArray *dataSource;

@property Class prototypeClass;
@property YONSView *prototypeView;
@end


@implementation KBListView

- (void)viewInit {
  [super viewInit];
  self.wantsLayer = YES;
//  self.layer.borderColor = [KBAppearance.currentAppearance lineColor].CGColor;
//  self.layer.borderWidth = 1.0;

  _dataSource = [NSMutableArray array];

  _tableView = [[NSTableView alloc] init];
  _tableView.dataSource = self;
  _tableView.delegate = self;
  _tableView.intercellSpacing = CGSizeZero;
  _tableView.selectionHighlightStyle = NSTableViewSelectionHighlightStyleRegular;
  //_tableView.gridStyleMask = NSTableViewSolidHorizontalGridLineMask;
  [_tableView setHeaderView:nil];

  NSTableColumn *column1 = [[NSTableColumn alloc] initWithIdentifier:@""];
  [_tableView addTableColumn:column1];

  _scrollView = [[KBScrollView alloc] init];
  [_scrollView setDocumentView:_tableView];
  [self addSubview:_scrollView];

  self.viewLayout = [YOLayout fill:_scrollView];
}

+ (KBListView *)listViewWithPrototypeClass:(Class)prototypeClass rowHeight:(CGFloat)rowHeight {
  Class tableViewClass = KBListView.class;
  if (rowHeight == 0) tableViewClass = KBListViewDynamicHeight.class;

  KBListView *tableView = [[tableViewClass alloc] init];
  tableView.prototypeClass = prototypeClass;
  if (rowHeight > 0) tableView.tableView.rowHeight = rowHeight;
  return tableView;
}

+ (KBListView *)listViewWithRowHeight:(CGFloat)rowHeight {
  KBListView *tableView = [[KBListView alloc] init];
  tableView.tableView.rowHeight = rowHeight;
  return tableView;
}

- (void)layout {
  [super layout];
  // TODO This causes some jankiness
  //[self.tableView reloadData];
}

- (void)removeAllObjects {
  [_dataSource removeAllObjects];
  [_tableView reloadData];
}

- (void)setObjects:(NSArray *)objects {
  [_dataSource removeAllObjects];
  if (objects) [_dataSource addObjectsFromArray:objects];
  [_tableView reloadData];
}

- (void)addObjects:(NSArray *)objects {
  [_dataSource addObjectsFromArray:objects];
  [_tableView reloadData];
}

- (NSInteger)numberOfRowsInTableView:(NSTableView *)tableView {
  return [_dataSource count];
}

- (void)deselectAll {
  [_tableView deselectAll:nil];
}

- (NSView *)viewForRow:(NSInteger)row {
  id object = [_dataSource objectAtIndex:row];
  YONSView *view = [_tableView makeViewWithIdentifier:NSStringFromClass(_prototypeClass) owner:self];
  BOOL dequeued = NO;
  if (!view) {
    dequeued = YES;
    view = [[_prototypeClass alloc] init];
    view.identifier = NSStringFromClass(_prototypeClass);
  }

  self.cellSetBlock(view, object, [NSIndexPath indexPathWithIndex:row], _tableView, dequeued);
  if ([view respondsToSelector:@selector(setNeedsLayout)]) [view setNeedsLayout];
  return view;
}

- (NSView *)tableView:(NSTableView *)tableView viewForTableColumn:(NSTableColumn *)tableColumn row:(NSInteger)row {
  return [self viewForRow:row];
}

- (id)selectedObject {
  NSInteger selectedRow = [_tableView selectedRow];
  if (selectedRow < 0) return nil;
  return _dataSource[selectedRow];
}


- (void)tableViewSelectionDidChange:(NSNotification *)notification {
  NSInteger selectedRow = [_tableView selectedRow];
  if (selectedRow < 0) return;
  id object = [_dataSource objectAtIndex:selectedRow];
  if (self.selectBlock) self.selectBlock(self, [NSIndexPath indexPathWithIndex:selectedRow], object);
}

- (void)removeAllTableColumns {
  for (NSTableColumn *tableColumn in [_tableView.tableColumns copy]) {
    [_tableView removeTableColumn:tableColumn];
  }
}

@end

@implementation KBListViewDynamicHeight

- (CGFloat)tableView:(NSTableView *)tableView heightOfRow:(NSInteger)row {
  if (!self.prototypeView) self.prototypeView = [[self.prototypeClass alloc] init];
  id object = [self.dataSource objectAtIndex:row];

  self.cellSetBlock(self.prototypeView, object, [NSIndexPath indexPathWithIndex:row], self.tableView, NO);
  [self.prototypeView.viewLayout setNeedsLayout];

  CGFloat height = [self.prototypeView sizeThatFits:CGSizeMake(self.frame.size.width, CGFLOAT_MAX)].height;
  //GHDebug(@"Row: %@, height: %@, width: %@", @(row), @(height), @(self.frame.size.width));
  return height;
}

@end
