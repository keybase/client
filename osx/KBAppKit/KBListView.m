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

+ (instancetype)listViewWithRowHeight:(CGFloat)rowHeight {
  return [self listViewWithPrototypeClass:nil rowHeight:rowHeight];
}

+ (instancetype)listViewWithPrototypeClass:(Class)prototypeClass rowHeight:(CGFloat)rowHeight {
  KBListView *listView = [[KBListView alloc] init];

  listView.view.intercellSpacing = CGSizeZero;

  if (prototypeClass) {
    listView.onIdentifier = ^(NSIndexPath *indexPath, NSTableColumn *tableColumn, KBListView *listView) {
      return NSStringFromClass(prototypeClass);
    };
    listView.onCreate = ^(NSIndexPath *indexPath, NSTableColumn *tableColumn, KBListView *listView) {
      NSView *view = [[prototypeClass alloc] init];
      view.identifier = NSStringFromClass(prototypeClass);
      return view;
    };
  }

  NSTableColumn *column1 = [[NSTableColumn alloc] initWithIdentifier:@""];
  [listView.view addTableColumn:column1];
  [listView.view setHeaderView:nil];

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

  NSIndexPath *indexPath = [NSIndexPath indexPathForItem:row inSection:0];
  NSString *identifier = self.onIdentifier(indexPath, tableColumn, self);

  NSView *view = [self.view makeViewWithIdentifier:identifier owner:self];
  BOOL dequeued = NO;
  if (!view) {
    dequeued = YES;
    view = self.onCreate(indexPath, tableColumn, self);
  }
  self.onSet(view, object, indexPath, tableColumn, self, dequeued);
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
    NSIndexPath *indexPath = [NSIndexPath indexPathForItem:row inSection:0];
    if (!self.prototypeView) {
      self.prototypeView = self.onCreate(indexPath, nil, self);
    }
    id object = [self.dataSource objectAtIndexPath:indexPath];
    self.onSet(self.prototypeView, object, indexPath, nil, self, NO);
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
