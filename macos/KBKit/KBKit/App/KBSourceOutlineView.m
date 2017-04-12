//
//  KBSourceOutlineView.m
//  Keybase
//
//  Created by Gabriel on 2/5/15.
//  Copyright (c) 2015 Gabriel Handford. All rights reserved.
//

#import "KBSourceOutlineView.h"

#import <GHODictionary/GHODictionary.h>

@interface KBSourceOutlineView ()
@property NSOutlineView *outlineView;
@property GHODictionary *data;
@property KBActivityIndicatorView *progressView;
@property KBUserStatusView *statusView;
@end

@implementation KBSourceOutlineView

- (void)viewInit {
  [super viewInit];
  _outlineView = [[NSOutlineView alloc] init];
  _outlineView.delegate = self;
  _outlineView.dataSource = self;
  _data = [GHODictionary dictionary];
  //_outlineView.floatsGroupRows = NO;
  _outlineView.selectionHighlightStyle = NSTableViewSelectionHighlightStyleSourceList;
  //[self addSubview:_outlineView];
  [self.data setObject:@[@"Me", @"Users", @"Devices", @"Folders"] forKey:@"Keybase"];

  dispatch_async(dispatch_get_main_queue(), ^{
    [self.outlineView reloadItem:nil reloadChildren:YES];
    [self.outlineView expandItem:nil expandChildren:YES];
  });

  _progressView = [[KBActivityIndicatorView alloc] init];
  [self addSubview:_progressView];

  _statusView = [[KBUserStatusView alloc] init];
  GHWeakSelf gself = self;
  KBButtonView *button = [KBButtonView buttonViewWithView:_statusView targetBlock:^{ [gself didSelectItem:KBAppViewItemProfile]; }];
  [self addSubview:button];

  KBScrollView *scrollView = [[KBScrollView alloc] init];
  [scrollView setDocumentView:_outlineView];
  [self addSubview:scrollView];

  KBBox *border = [KBBox horizontalLine];
  [self addSubview:border];

  KBBox *rightBorder = [KBBox line];
  [self addSubview:rightBorder];

  _outlineView.backgroundColor = KBAppearance.currentAppearance.secondaryBackgroundColor; // Have to set after in scrollview

  YOSelf yself = self;
  self.viewLayout = [YOLayout layoutWithLayoutBlock:^CGSize(id<YOLayout> layout, CGSize size) {

    [layout setFrame:CGRectMake(self.frame.size.width - 24, 4, 20, 20) view:yself.progressView];

    CGSize statusViewSize = [yself.statusView sizeThatFits:size];
    [layout setFrame:CGRectMake(0, -20, size.width, size.height - statusViewSize.height) view:scrollView];
    [layout setFrame:CGRectMake(0, size.height - statusViewSize.height - 1, size.width, 1) view:border];
    [layout setFrame:CGRectMake(0, size.height - statusViewSize.height, statusViewSize.width, statusViewSize.height) view:button];
    [layout setFrame:CGRectMake(size.width - 1, 0, 1, size.height) view:rightBorder];
    return size;
  }];
}

- (void)setProgressEnabled:(BOOL)progressEnabled {
  [_progressView setAnimating:progressEnabled];
}

- (BOOL)isProgressEnabled {
  return _progressView.isAnimating;
}

- (void)notifyItemSelected:(KBAppViewItem)item {
  [self.delegate sourceOutlineView:self didSelectItem:item];
}

- (void)didSelectItem:(KBAppViewItem)item {
  [self selectItem:item];
  [self notifyItemSelected:item];
}

- (void)outlineViewSelectionDidChange:(NSNotification *)notification {
  if ([_outlineView selectedRow] != -1) {
    NSString *item = [_outlineView itemAtRow:[_outlineView selectedRow]];
    if ([_outlineView parentForItem:item] != nil) {
      if ([item isEqualTo:@"Me"]) [self notifyItemSelected:KBAppViewItemProfile];
      if ([item isEqualTo:@"Users"]) [self notifyItemSelected:KBAppViewItemUsers];
      if ([item isEqualTo:@"Devices"]) [self notifyItemSelected:KBAppViewItemDevices];
      if ([item isEqualTo:@"Folders"]) [self notifyItemSelected:KBAppViewItemFolders];
    }
  }
}

- (void)selectItem:(KBAppViewItem)item {
  if ([_outlineView selectedRow] != item) {
    [_outlineView selectRowIndexes:[NSIndexSet indexSetWithIndex:item] byExtendingSelection:NO];
  }
}

- (NSArray *)_childrenForItem:(id)item {
  if (!item) return [_data allKeys];
  return [_data objectForKey:item];
}

- (id)outlineView:(NSOutlineView *)outlineView child:(NSInteger)index ofItem:(id)item {
  return [[self _childrenForItem:item] objectAtIndex:index];
}

- (BOOL)outlineView:(NSOutlineView *)outlineView isItemExpandable:(id)item {
  return ![outlineView parentForItem:item];
}

- (NSInteger)outlineView:(NSOutlineView *)outlineView numberOfChildrenOfItem:(id)item {
  return [[self _childrenForItem:item] count];
}

- (BOOL)outlineView:(NSOutlineView *)outlineView isGroupItem:(id)item {
  return !!_data[item];
}

- (BOOL)outlineView:(NSOutlineView *)outlineView shouldShowOutlineCellForItem:(id)item {
  return NO;
}

- (BOOL)outlineView:(NSOutlineView *)outlineView shouldSelectItem:(id)item {
  return !_data[item];
}

//- (void)outlineView:(NSOutlineView *)outlineView didAddRowView:(NSTableRowView *)rowView forRow:(NSInteger)row {
//}

- (NSTableRowView *)outlineView:(NSOutlineView *)outlineView rowViewForItem:(id)item {
  if ([self outlineView:outlineView isGroupItem:item]) return nil;

  KBLabelRow *labelRow = [outlineView makeViewWithIdentifier:@"KBLabelRow" owner:self];
  if (!labelRow) labelRow = [[KBLabelRow alloc] init];
  labelRow.selectionHighlightStyle = NSTableViewSelectionHighlightStyleSourceList;
  labelRow.label.verticalAlignment = KBVerticalAlignmentMiddle;
  [labelRow.label setText:item style:KBTextStyleDefault];
  return labelRow;
}

- (NSView *)outlineView:(NSOutlineView *)outlineView viewForTableColumn:(NSTableColumn *)tableColumn item:(id)item {
  return nil;
  /*
  KBLabel *label = [outlineView makeViewWithIdentifier:@"ColumnView" owner:self];
  if (!label) label = [[KBLabel alloc] init];
  label.verticalAlignment = KBVerticalAlignmentMiddle;
  [label setText:[item uppercaseString] font:[NSFont systemFontOfSize:12] color:[KBAppearance.currentAppearance textColor] alignment:NSLeftTextAlignment lineBreakMode:NSLineBreakByTruncatingTail];
  return label;
   */
}

- (CGFloat)outlineView:(NSOutlineView *)outlineView heightOfRowByItem:(id)item {
  if ([item isEqualTo:@"Keybase"]) return 0;
  return 26;
}

@end
