//
//  KBListView.m
//  Keybase
//
//  Created by Gabriel on 3/9/15.
//  Copyright (c) 2015 Gabriel Handford. All rights reserved.
//

#import "KBListView.h"

#import "NSView+KBView.h"
#import "KBTitleView.h"
#import "KBBox.h"

#define GROUP_ROW_HEIGHT (24) // TODO Hardcoded height

@interface KBListView ()
@property Class prototypeClass;
@property YOView *prototypeView;

@property KBProgressOverlayView *progressView;
@property CGFloat rowHeight;
@end

@implementation KBListView

- (void)viewInit {
  [super viewInit];
  _progressView = [[KBProgressOverlayView alloc] init];
  [self addSubview:_progressView];
}

- (void)layout {
  [super layout];
  _progressView.frame = self.bounds;
}

+ (instancetype)listViewWithPrototypeClass:(Class)prototypeClass rowHeight:(CGFloat)rowHeight {
  KBListView *listView = [[KBListView alloc] init];

  listView.view.intercellSpacing = CGSizeZero;

  NSTableColumn *column1 = [[NSTableColumn alloc] initWithIdentifier:@""];
  [listView.view addTableColumn:column1];
  [listView.view setHeaderView:nil];

  listView.prototypeClass = prototypeClass;
  listView.rowHeight = rowHeight;
  return listView;
}

- (NSView *)tableView:(NSTableView *)tableView viewForTableColumn:(NSTableColumn *)tableColumn row:(NSInteger)row {
  id object = [self.dataSource objectAtIndexPath:[NSIndexPath indexPathForItem:row inSection:0]];

  // Header
  if ([object isKindOfClass:KBTableViewHeader.class]) {
    KBTitleView *titleView = [[KBTitleView alloc] init];
    [titleView.label setText:[[object title] uppercaseString] style:KBTextStyleDefault alignment:NSLeftTextAlignment lineBreakMode:NSLineBreakByTruncatingTail];
    titleView.height = GROUP_ROW_HEIGHT;
    return titleView;
  }

  /*
  KBCellView *cellView = [self.view makeViewWithIdentifier:NSStringFromClass(self.prototypeClass) owner:self];
  BOOL dequeued = NO;
  id view;
  if (!cellView) {
    dequeued = YES;
    view = [[_prototypeClass alloc] init];
    cellView = [[KBCellView alloc] init];
    cellView.identifier = NSStringFromClass(_prototypeClass);
    [cellView setView:view];
  } else {
    view = cellView.view;
  }

  self.cellSetBlock(view, object, [NSIndexPath indexPathForItem:row], tableColumn, self, dequeued);
  if ([view respondsToSelector:@selector(setNeedsLayout)]) [view setNeedsLayout];
  return cellView;
   */

  NSView *view = [self.view makeViewWithIdentifier:NSStringFromClass(self.prototypeClass) owner:self];
  BOOL dequeued = NO;
  if (!view) {
    dequeued = YES;
    view = [[_prototypeClass alloc] init];
    view.identifier = NSStringFromClass(_prototypeClass);
  }
  self.cellSetBlock(view, object, [NSIndexPath indexPathForItem:row inSection:0], tableColumn, self, dequeued);
  if ([view respondsToSelector:@selector(setNeedsLayout)]) [(id)view setNeedsLayout];
  return view;
}

- (BOOL)tableView:(NSTableView *)tableView isGroupRow:(NSInteger)row {
  id obj = [self.dataSource objectAtIndexPath:[NSIndexPath indexPathForItem:row inSection:0]];
  return ([obj isKindOfClass:KBTableViewHeader.class]);
}

- (CGFloat)tableView:(NSTableView *)tableView heightOfRow:(NSInteger)row {
  if ([self tableView:tableView isGroupRow:row]) {
    return GROUP_ROW_HEIGHT;
  }

  if (_rowHeight > 0) {
    return _rowHeight;
  } else {
    if (!self.prototypeView) self.prototypeView = [[self.prototypeClass alloc] init];
    id object = [self.dataSource objectAtIndexPath:[NSIndexPath indexPathForItem:row inSection:0]];

    self.cellSetBlock(self.prototypeView, object, [NSIndexPath indexPathForItem:row inSection:0], nil, self, NO);
    [self.prototypeView setNeedsLayout:NO];

    CGFloat width = tableView.frame.size.width;

    width -= tableView.intercellSpacing.width;
    CGFloat verticalScrollWidth = [NSScroller scrollerWidthForControlSize:self.scrollView.verticalScroller.controlSize scrollerStyle:self.scrollView.verticalScroller.scrollerStyle];
    width -= verticalScrollWidth;

    CGFloat height = [self.prototypeView sizeThatFits:CGSizeMake(width, CGFLOAT_MAX)].height;
    return height;
  }
}

@end


@interface KBCellView ()
@property NSBox *border;
@end

@implementation KBCellView

- (instancetype)initWithFrame:(NSRect)frame {
  if ((self = [super initWithFrame:frame])) {
    self.autoresizesSubviews = NO;
    _border = [[NSBox alloc] init];
    _border.borderWidth = 1.0;
    _border.borderType = NSLineBorder;
    _border.borderColor = KBAppearance.currentAppearance.lineColor;
    _border.boxType = NSBoxCustom;
    [self addSubview:_border];
  }
  return self;
}

- (void)layout {
  [super layout];
  [_view setFrame:self.bounds];
  [_border setFrame:CGRectMake(0, self.bounds.size.height - 1, self.bounds.size.width, 1)];
}

- (void)setView:(id)view {
  [_view removeFromSuperview];
  _view = view;
  [self addSubview:_view];
  self.needsLayout = YES;
}

- (void)setBackgroundStyle:(NSBackgroundStyle)backgroundStyle {
  [_view setBackgroundStyle:backgroundStyle];
}

@end
