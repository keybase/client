//
//  KBSourceOutlineView.m
//  Keybase
//
//  Created by Gabriel on 2/5/15.
//  Copyright (c) 2015 Gabriel Handford. All rights reserved.
//

#import "KBSourceOutlineView.h"
#import "KBUserStatusView.h"

#import <MPMessagePack/MPOrderedDictionary.h>

@interface KBSourceOutlineView ()
@property NSOutlineView *outlineView;
@property MPOrderedDictionary *data;
@property KBActivityIndicatorView *progressView;
@property KBUserStatusView *statusView;
@end

@implementation KBSourceOutlineView

- (void)viewInit {
  [super viewInit];
  _outlineView = [[NSOutlineView alloc] init];
  _outlineView.delegate = self;
  _outlineView.dataSource = self;
  _data = [MPOrderedDictionary dictionary];
  _outlineView.floatsGroupRows = NO;
  _outlineView.selectionHighlightStyle = NSTableViewSelectionHighlightStyleSourceList;
  [self addSubview:_outlineView];
  [self.data setObject:@[@"Users", @"Devices", @"Folders"] forKey:@"Keybase"];

  dispatch_async(dispatch_get_main_queue(), ^{
    [self.outlineView reloadItem:nil reloadChildren:YES];
    [self.outlineView expandItem:nil expandChildren:YES];
  });

  _progressView = [[KBActivityIndicatorView alloc] init];
  [self addSubview:_progressView];

  KBBox *border = [KBBox lineWithWidth:1.0 color:KBAppearance.currentAppearance.lineColor];
  [self addSubview:border];

  _statusView = [[KBUserStatusView alloc] init];
  GHWeakSelf gself = self;
  _statusView.button.actionBlock = ^(id sender) { [gself selectItem:KBSourceViewItemProfile]; };
  [self addSubview:_statusView];

  YOSelf yself = self;
  self.viewLayout = [YOLayout layoutWithLayoutBlock:^CGSize(id<YOLayout> layout, CGSize size) {

    [layout setFrame:CGRectMake(self.frame.size.width - 24, 4, 20, 20) view:yself.progressView];

    CGSize statusViewSize = [yself.statusView sizeThatFits:size];
    [layout setFrame:CGRectMake(0, 0, size.width, size.height - statusViewSize.height) view:yself.outlineView];
    [layout setFrame:CGRectMake(0, size.height - statusViewSize.height - 1, size.width, 1) view:border];
    [layout setFrame:CGRectMake(0, size.height - statusViewSize.height, statusViewSize.width, statusViewSize.height) view:yself.statusView];

    return size;
  }];
}

- (void)setProgressEnabled:(BOOL)progressEnabled {
  [_progressView setAnimating:progressEnabled];
}

- (BOOL)isProgressEnabled {
  return _progressView.isAnimating;
}

- (void)selectItem:(KBSourceViewItem)item {
  if (item == KBSourceViewItemProfile) {
    [_outlineView deselectAll:self];
  }
  [self.delegate sourceOutlineView:self didSelectItem:item];
}

- (void)outlineViewSelectionDidChange:(NSNotification *)notification {
  if ([_outlineView selectedRow] != -1) {
    NSString *item = [_outlineView itemAtRow:[_outlineView selectedRow]];
    if ([_outlineView parentForItem:item] != nil) {
      if ([item isEqualTo:@"Users"]) [self selectItem:KBSourceViewItemUsers];
      if ([item isEqualTo:@"Devices"]) [self selectItem:KBSourceViewItemDevices];
      if ([item isEqualTo:@"Folders"]) [self selectItem:KBSourceViewItemFolders];
    }
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
  [labelRow.label setText:item style:KBLabelStyleDefault];
  return labelRow;
}

- (NSView *)outlineView:(NSOutlineView *)outlineView viewForTableColumn:(NSTableColumn *)tableColumn item:(id)item {
  KBLabel *label = [outlineView makeViewWithIdentifier:@"ColumnView" owner:self];
  if (!label) label = [[KBLabel alloc] init];
  label.verticalAlignment = KBVerticalAlignmentMiddle;
  [label setText:[item uppercaseString] font:[NSFont systemFontOfSize:12] color:[KBAppearance.currentAppearance textColor] alignment:NSLeftTextAlignment lineBreakMode:NSLineBreakByTruncatingTail];
  return label;
}

- (CGFloat)outlineView:(NSOutlineView *)outlineView heightOfRowByItem:(id)item {
  return 26;
}

@end
