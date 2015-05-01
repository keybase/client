//
//  KBListView.m
//  Keybase
//
//  Created by Gabriel on 2/2/15.
//  Copyright (c) 2015 Gabriel Handford. All rights reserved.
//

#import "KBTableView.h"

#import "KBAppearance.h"
#import "KBScrollView.h"
#import "KBCellDataSource.h"
#import "KBLayouts.h"
#import <GHKit/GHKit.h>
#import <ObjectiveSugar/ObjectiveSugar.h>

@interface KBNSTableView : NSTableView
@property (weak) KBTableView *parent;
@end

@interface KBTableScrollView : NSScrollView
@property (weak) KBTableView *parent;
@end

@interface KBTableView ()
@property KBTableScrollView *scrollView;
@property KBNSTableView *view;
@property KBCellDataSource *dataSource;
//@property BOOL selecting;
@property NSIndexPath *menuIndexPath;
@end

@implementation KBTableView

- (void)viewInit {
  [super viewInit];
  _dataSource = [[KBCellDataSource alloc] init];

  KBNSTableView *view = [[KBNSTableView alloc] init];
  view.parent = self;
  _view = view;
  _view.dataSource = self;
  _view.delegate = self;

  KBTableScrollView *scrollView = [[KBTableScrollView alloc] init];
  scrollView.parent = self;
  _scrollView = scrollView;
  _scrollView.hasVerticalScroller = YES;
  _scrollView.verticalScrollElasticity = NSScrollElasticityAllowed;
  _scrollView.autohidesScrollers = YES;
  _scrollView.automaticallyAdjustsContentInsets = YES;
  [_scrollView setDocumentView:_view];
  [self addSubview:_scrollView];

  YOSelf yself = self;
  self.viewLayout = [YOLayout layoutWithLayoutBlock:^(id<YOLayout> layout, CGSize size) {
    UIEdgeInsets insets = UIEdgeInsetsZero;
    [layout setFrame:CGRectMake(insets.left, insets.top, size.width - insets.left - insets.right, size.height - insets.top - insets.bottom) view:yself.scrollView];
    return size;
  }];
}

- (void)layout {
  [super layout];
  //[self.view noteHeightOfRowsWithIndexesChanged:[NSIndexSet indexSetWithIndexesInRange:NSMakeRange(0, self.view.numberOfRows)]];
  [self.view reloadData];
}

- (void)removeAllObjects {
  [_dataSource removeAllObjects];
  [_view reloadData];
}

- (void)setObjects:(NSArray *)objects {
  [_dataSource setObjects:objects];
  [_view reloadData];
}

- (void)deselectRow {
  if (_view.selectedRow >= 0) [_view deselectRow:_view.selectedRow];
}

- (void)setObjects:(NSArray *)objects animated:(BOOL)animated {
  [self update:^(KBTableView *tableView) {
    NSMutableArray *indexPathsToRemove = [NSMutableArray array];
    NSMutableArray *indexPathsToUpdate = [NSMutableArray array];
    NSMutableArray *indexPathsToAdd = [NSMutableArray array];
    //if ([indexPathsToRemove count] == 0 && [indexPathsToAdd count] == 0) return;
    [tableView.dataSource updateObjects:objects section:0 indexPathsToAdd:indexPathsToAdd indexPathsToUpdate:indexPathsToUpdate indexPathsToRemove:indexPathsToRemove];
    if (animated) {
      [tableView.view beginUpdates];
      if ([indexPathsToRemove count] > 0) [tableView.view removeRowsAtIndexes:[self itemIndexSet:indexPathsToRemove] withAnimation:0];
      if ([indexPathsToAdd count] > 0) [tableView.view insertRowsAtIndexes:[self itemIndexSet:indexPathsToAdd] withAnimation:0];
      if ([indexPathsToUpdate count] > 0) [tableView.view reloadDataForRowIndexes:[self itemIndexSet:indexPathsToUpdate] columnIndexes:[self sectionIndexSet:indexPathsToUpdate]];
      [tableView.view endUpdates];
    } else {
      [tableView reloadData];
    }
  }];
}

- (void)update:(void (^)(KBTableView *tableView))block {
  id selectedObject = [self selectedObject];
  [self deselectRow];

  block(self);

  if (selectedObject) {
    NSIndexPath *indexPath = [_dataSource indexPathOfObject:selectedObject section:0];
    if (indexPath) [self setSelectedRow:indexPath.item];
  }
}

- (void)addObjects:(NSArray *)objects {
  NSMutableArray *indexPaths = [NSMutableArray array];
  [self.dataSource addObjects:objects section:0 indexPaths:indexPaths];
  [self.view beginUpdates];
  if ([indexPaths count] > 0) [self.view insertRowsAtIndexes:[self itemIndexSet:indexPaths] withAnimation:NSTableViewAnimationSlideUp];
  [self.view endUpdates];
}

- (NSArray *)objects {
  return [_dataSource objectsForSection:0];
}

- (NSArray *)objectsWithoutHeaders {
  return [[_dataSource objectsForSection:0] reject:^BOOL(id object) {
    return [object isKindOfClass:KBTableViewHeader.class];
  }];
}

- (NSIndexSet *)itemIndexSet:(NSArray *)indexPaths {
  NSMutableIndexSet *indexSet = [[NSMutableIndexSet alloc] init];
  for (NSIndexPath *indexPath in indexPaths) {
    [indexSet addIndex:indexPath.item];
  }
  return indexSet;
}

- (NSIndexSet *)sectionIndexSet:(NSArray *)indexPaths {
  NSMutableIndexSet *indexSet = [[NSMutableIndexSet alloc] init];
  for (NSIndexPath *indexPath in indexPaths) {
    [indexSet addIndex:indexPath.section];
  }
  return indexSet;
}

- (NSInteger)numberOfRowsInTableView:(NSTableView *)tableView {
  return [_dataSource countForSection:0];
}

- (void)deselectAll {
  [_view deselectAll:nil];
}

- (NSInteger)nextRowUp {
  NSInteger selectedRow = [_view selectedRow];
  if (selectedRow <= 0) return NSNotFound;
  NSInteger count = [_dataSource countForSection:0];
  if (count == 0) return NSNotFound;

  NSInteger nextRow = NSNotFound;
  for (NSInteger i = selectedRow - 1; i >= 0; i--) {
    id obj = [_dataSource objectAtIndexPath:[NSIndexPath indexPathForItem:i inSection:0]];
    if (![obj isKindOfClass:KBTableViewHeader.class]) {
      nextRow = i;
      break;
    }
  }
  return nextRow;
}

- (void)moveUp:(id)sender {
  NSInteger row = [self nextRowUp];
  if (row != NSNotFound) [self setSelectedRow:row];
}

- (NSInteger)nextRowDown {
  NSInteger selectedRow = [_view selectedRow];
  NSInteger count = [_dataSource countForSection:0];
  if (count == 0 || selectedRow >= count-1) return NSNotFound;

  NSInteger nextRow = NSNotFound;
  for (NSInteger i = selectedRow + 1; i < self.rowCount; i++) {
    id obj = [_dataSource objectAtIndexPath:[NSIndexPath indexPathForItem:i inSection:0]];
    if (![obj isKindOfClass:KBTableViewHeader.class]) {
      nextRow = i;
      break;
    }
  }
  return nextRow;
}

- (void)moveDown:(id)sender {
  NSInteger row = [self nextRowDown];
  if (row != NSNotFound) [self setSelectedRow:row];
}

- (NSInteger)selectedRow {
  return _view.selectedRow;
}

- (void)setSelectedRow:(NSInteger)selectedRow {
  //NSAssert(!_selecting, @"In selection?");
  //_selecting = YES;
  if (_view.selectedRow >= 0 && _view.selectedRow == selectedRow) [_view deselectRow:selectedRow];
  [_view selectRowIndexes:[NSIndexSet indexSetWithIndex:selectedRow] byExtendingSelection:NO];
  [_view scrollRowToVisible:selectedRow];
  //_selecting = NO;
}

- (void)scrollToBottom:(BOOL)animated {
  NSInteger lastRowIndex = [_dataSource countForSection:0] - 1;
  if (lastRowIndex < 0) return;

  // TODO animated?
  animated = NO;
  if (animated) {
    NSRect rowRect = [_view rectOfRow:lastRowIndex];
    NSRect viewRect = [_scrollView frame];
    NSPoint scrollOrigin = rowRect.origin;
    scrollOrigin.y = scrollOrigin.y + (rowRect.size.height - viewRect.size.height);
    if (scrollOrigin.y < 0) scrollOrigin.y = 0;
    [[_scrollView animator] setBoundsOrigin:scrollOrigin];
  } else {
    [_view scrollRowToVisible:lastRowIndex];
  }
}

- (BOOL)isAtBottom {
  NSInteger lastRowIndex = [_dataSource countForSection:0] - 1;
  if (lastRowIndex < 0) return YES;
  NSRect lastRowRect = [_view rectOfRow:lastRowIndex];
  
  if (_scrollView.contentSize.height <= _scrollView.frame.size.height) return YES;

  CGFloat bottom = _scrollView.documentVisibleRect.origin.y + _scrollView.documentVisibleRect.size.height;
  return (bottom >= lastRowRect.origin.y);
}

- (id)selectedObject {
  NSInteger selectedRow = [_view selectedRow];
  if (selectedRow < 0) return nil;
  return [_dataSource objectAtIndexPath:[NSIndexPath indexPathForItem:selectedRow inSection:0]];
}

- (void)tableViewSelectionDidChange:(NSNotification *)notification {
  //if (_selecting) return; // If we are selecting programatically ignore the notification
  if (!self.onSelect) return;
  NSInteger selectedRow = [_view selectedRow];
  if (selectedRow < 0) {
    self.onSelect(self, nil, nil);
  } else {
    id object = [self selectedObject];
    if (object) {
      if ([object isKindOfClass:KBTableViewHeader.class]) {
        // Selected header?
      } else {
        self.onSelect(self, [NSIndexPath indexPathWithIndex:selectedRow], object);
      }
    }
  }
}

- (void)reloadData {
  [self.view reloadData];
}

- (void)removeAllTableColumns {
  for (NSTableColumn *tableColumn in [_view.tableColumns copy]) {
    [_view removeTableColumn:tableColumn];
  }
}

- (NSMenu *)menuForIndexPath:(NSIndexPath *)indexPath {
  _menuIndexPath = indexPath;
  if (self.onMenuSelect) return self.onMenuSelect(_menuIndexPath);
  return nil;
}

- (NSInteger)rowCount {
  return [_dataSource countForSection:0];
}

- (CGFloat)contentHeight:(CGFloat)max {
  CGFloat height = _view.intercellSpacing.height * 2;
  for (NSInteger row = 0, count = [self rowCount]; row < count; row++) {
    height += [self tableView:_view heightOfRow:row] + _view.intercellSpacing.height;
    if (height > max) return max;
  }
  return height;
}

@end

@implementation KBTableScrollView

- (void)reflectScrolledClipView:(NSClipView *)clipView {
  [super reflectScrolledClipView:clipView];
  if (self.parent.onUpdate) self.parent.onUpdate(self.parent);
}

@end


@implementation KBNSTableView

- (NSMenu *)menuForEvent:(NSEvent *)event {
  if (event.type != NSRightMouseDown) return nil;

  NSPoint point = [self convertPoint:[event locationInWindow] fromView:nil];
  NSInteger row = [self rowAtPoint:point];
  NSInteger column = [self columnAtPoint:point];
  if (row == -1 || column == -1) return nil;

  NSIndexPath *indexPath = [NSIndexPath indexPathForItem:row inSection:column];
  return [_parent menuForIndexPath:indexPath];
}

@end


@implementation KBTableViewHeader

+ (instancetype)tableViewHeaderWithTitle:(NSString *)title {
  KBTableViewHeader *header = [[KBTableViewHeader alloc] init];
  header.title = title;
  return header;
}

@end