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

@interface KBTableView ()
@property NSScrollView *scrollView;
@property KBNSTableView *view;
@property KBCellDataSource *dataSource;
@property BOOL selecting;
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

  _scrollView = [[NSScrollView alloc] init];
  _scrollView.hasVerticalScroller = YES;
  _scrollView.verticalScrollElasticity = NSScrollElasticityAllowed;
  _scrollView.autohidesScrollers = YES;
  [_scrollView setDocumentView:_view];
  [self addSubview:_scrollView];

  YOSelf yself = self;
  self.viewLayout = [YOLayout layoutWithLayoutBlock:^(id<YOLayout> layout, CGSize size) {
    UIEdgeInsets insets = yself.border.insets;
    [layout setSize:size view:yself.border options:0];
    [layout setFrame:CGRectMake(insets.left, insets.top, size.width - insets.left - insets.right, size.height - insets.top - insets.bottom) view:yself.scrollView];
    return size;
  }];

  // Fix scroll position with header view
  dispatch_async(dispatch_get_main_queue(), ^{
    [yself.view scrollPoint:NSMakePoint(0, -yself.view.headerView.frame.size.height)];
  });
}

- (void)setBorderEnabled:(BOOL)borderEnabled {
  if (borderEnabled) {
    _border = [[KBBorder alloc] init];
    [self addSubview:_border];
  } else {
    [_border removeFromSuperview];
    _border = nil;
  }
}

- (void)setBorderWithColor:(NSColor *)color width:(CGFloat)width {
  if (!_border) {
    _border = [[KBBorder alloc] init];
    [self addSubview:_border];
  }
  _border.color = color;
  _border.width = width;
  [self setNeedsLayout];
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
  id selectedObject = [self selectedObject];
  [self deselectRow];

  NSMutableArray *indexPathsToRemove = [NSMutableArray array];
  NSMutableArray *indexPathsToUpdate = [NSMutableArray array];
  NSMutableArray *indexPathsToAdd = [NSMutableArray array];
  //if ([indexPathsToRemove count] == 0 && [indexPathsToAdd count] == 0) return;
  [self.dataSource updateObjects:objects section:0 indexPathsToAdd:indexPathsToAdd indexPathsToUpdate:indexPathsToUpdate indexPathsToRemove:indexPathsToRemove];
  if (animated) {
    [_view beginUpdates];
    if ([indexPathsToRemove count] > 0) [_view removeRowsAtIndexes:[self itemIndexSet:indexPathsToRemove] withAnimation:0];
    if ([indexPathsToAdd count] > 0) [_view insertRowsAtIndexes:[self itemIndexSet:indexPathsToAdd] withAnimation:0];
    if ([indexPathsToUpdate count] > 0) [_view reloadDataForRowIndexes:[self itemIndexSet:indexPathsToUpdate] columnIndexes:[self sectionIndexSet:indexPathsToUpdate]];
    [_view endUpdates];
  } else {
    [_view reloadData];
  }
  
  if (selectedObject) {
    NSIndexPath *indexPath = [_dataSource indexPathOfObject:selectedObject section:0];
    if (indexPath) [self setSelectedRow:indexPath.item];
  }
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

- (void)addObjects:(NSArray *)objects {
  [_dataSource addObjects:objects];
  [_view reloadData];
}

- (NSInteger)numberOfRowsInTableView:(NSTableView *)tableView {
  return [_dataSource countForSection:0];
}

- (void)deselectAll {
  [_view deselectAll:nil];
}

- (BOOL)canMoveUp {
  NSInteger selectedRow = [_view selectedRow];
  if (selectedRow <= 0) return NO;
  NSInteger count = [_dataSource countForSection:0];
  if (count == 0) return NO;
  return YES;
}

- (void)moveUp:(id)sender {
  if ([self canMoveUp]) [self setSelectedRow:_view.selectedRow-1];
}

- (BOOL)canMoveDown {
  NSInteger selectedRow = [_view selectedRow];
  NSInteger count = [_dataSource countForSection:0];
  if (count == 0 || selectedRow >= count-1) return NO;
  return YES;
}

- (void)moveDown:(id)sender {
  if ([self canMoveDown]) [self setSelectedRow:_view.selectedRow+1];
}

- (NSInteger)selectedRow {
  return _view.selectedRow;
}

- (void)setSelectedRow:(NSInteger)selectedRow {
  NSAssert(!_selecting, @"In selection?");
  _selecting = YES;
  if (_view.selectedRow >= 0 && _view.selectedRow == selectedRow) [_view deselectRow:selectedRow];
  [_view selectRowIndexes:[NSIndexSet indexSetWithIndex:selectedRow] byExtendingSelection:NO];
  [_view scrollRowToVisible:selectedRow];
  _selecting = NO;
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
  //GHDebug(@"Last row rect: %@", YONSStringFromCGRect(lastRowRect));
  //GHDebug(@"Doc visible rect: %@", YONSStringFromCGRect(_scrollView.documentVisibleRect));

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
  if (_selecting) return; // If we are selecting programatically ignore the notification
  if (!self.selectBlock) return;
  NSInteger selectedRow = [_view selectedRow];
  if (selectedRow < 0) {
    self.selectBlock(self, nil, nil);
  } else {
    id object = [self selectedObject];
    if (object) {
      if ([object isKindOfClass:KBTableViewHeader.class]) {
        // Selected header?
      } else {
        self.selectBlock(self, [NSIndexPath indexPathWithIndex:selectedRow], object);
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
  if (self.menuSelectBlock) return self.menuSelectBlock(_menuIndexPath);
  return nil;
}

- (NSInteger)rowCount {
  return [_dataSource countForSection:0];
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