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
    titleView.height = 24;
    return titleView;
  }

  YOView *view = [self.view makeViewWithIdentifier:NSStringFromClass(self.prototypeClass) owner:self];
  BOOL dequeued = NO;
  if (!view) {
    dequeued = YES;
    view = [[_prototypeClass alloc] init];
    view.identifier = NSStringFromClass(_prototypeClass);
  }

  self.cellSetBlock(view, object, [NSIndexPath indexPathWithIndex:row], tableColumn, self, dequeued);
  if ([view respondsToSelector:@selector(setNeedsLayout)]) [view setNeedsLayout];
  return view;
}

- (BOOL)tableView:(NSTableView *)tableView isGroupRow:(NSInteger)row {
  id obj = [self.dataSource objectAtIndexPath:[NSIndexPath indexPathForItem:row inSection:0]];
  return ([obj isKindOfClass:KBTableViewHeader.class]);
}

- (CGFloat)tableView:(NSTableView *)tableView heightOfRow:(NSInteger)row {
  if (_rowHeight > 0) {
    id obj = [self.dataSource objectAtIndexPath:[NSIndexPath indexPathForItem:row inSection:0]];
    if ([obj isKindOfClass:KBTableViewHeader.class]) {
      return 24;
    } else {
      return _rowHeight;
    }
  } else {
    if (!self.prototypeView) self.prototypeView = [[self.prototypeClass alloc] init];
    id object = [self.dataSource objectAtIndexPath:[NSIndexPath indexPathForItem:row inSection:0]];

    self.cellSetBlock(self.prototypeView, object, [NSIndexPath indexPathWithIndex:row], nil, self, NO);
    [self.prototypeView setNeedsLayout:NO];

    //CGFloat verticalScrollWidth = [NSScroller scrollerWidthForControlSize:self.scrollView.verticalScroller.controlSize scrollerStyle:self.scrollView.verticalScroller.scrollerStyle];
    CGFloat width = tableView.frame.size.width - 10;// - verticalScrollWidth;
    CGFloat height = [self.prototypeView sizeThatFits:CGSizeMake(width, CGFLOAT_MAX)].height;
    return height;
  }
}

@end
