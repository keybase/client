//
//  KBSourceOutlineView.m
//  Keybase
//
//  Created by Gabriel on 2/5/15.
//  Copyright (c) 2015 Gabriel Handford. All rights reserved.
//

#import "KBSourceOutlineView.h"

#import <MPMessagePack/MPOrderedDictionary.h>

@interface KBSourceOutlineView ()
@property NSOutlineView *outlineView;
@property MPOrderedDictionary *data;
@property KBActivityIndicatorView *progressView;
@end

@implementation KBSourceOutlineView

- (instancetype)initWithFrame:(NSRect)frameRect {
  if ((self = [super initWithFrame:frameRect])) {
    _outlineView = [[NSOutlineView alloc] init];
    [self addSubview:_outlineView];

    _outlineView.delegate = self;
    _outlineView.dataSource = self;
    _data = [MPOrderedDictionary dictionary];
    [_data setObject:@[@"Profile", @"Users", @"Devices", @"Folders", @"Debug"] forKey:@"Keybase"];
    _outlineView.floatsGroupRows = NO;
    [_outlineView reloadData];
    [_outlineView expandItem:nil expandChildren:YES];

    _progressView = [[KBActivityIndicatorView alloc] init];
    [self addSubview:_progressView];
  }
  return self;
}

- (void)layout {
  [super layout];
  //_outlineView.frame = CGRectMake(0, 27, self.frame.size.width, self.frame.size.height - 27);
  _outlineView.frame = self.bounds;
  _progressView.frame = CGRectMake(self.frame.size.width - 24, 4, 20, 20);
}

- (void)setProgressEnabled:(BOOL)progressEnabled {
  [_progressView setAnimating:progressEnabled];
}

- (BOOL)isProgressEnabled {
  return _progressView.isAnimating;
}

- (void)outlineViewSelectionDidChange:(NSNotification *)notification {
  if ([_outlineView selectedRow] != -1) {
    NSString *item = [_outlineView itemAtRow:[_outlineView selectedRow]];
    if ([_outlineView parentForItem:item] != nil) {
      if ([item isEqualTo:@"Profile"]) [self.delegate sourceOutlineView:self didSelectItem:KBSourceViewItemProfile];
      if ([item isEqualTo:@"Users"]) [self.delegate sourceOutlineView:self didSelectItem:KBSourceViewItemUsers];
      if ([item isEqualTo:@"Devices"]) [self.delegate sourceOutlineView:self didSelectItem:KBSourceViewItemDevices];
      if ([item isEqualTo:@"Folders"]) [self.delegate sourceOutlineView:self didSelectItem:KBSourceViewItemFolders];
      if ([item isEqualTo:@"Debug"]) [self.delegate sourceOutlineView:self didSelectItem:KBSourceViewItemDebug];
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

//- (void)outlineView:(NSOutlineView *)outlineView didAddRowView:(NSTableRowView *)rowView forRow:(NSInteger)row {
//}

- (NSTableRowView *)outlineView:(NSOutlineView *)outlineView rowViewForItem:(id)item {
  if ([self outlineView:outlineView isGroupItem:item]) return nil;
  KBLabelRow *labelRow = [outlineView makeViewWithIdentifier:@"KBLabelRow" owner:self];
  if (!labelRow) labelRow = [[KBLabelRow alloc] init];
  labelRow.selectionHighlightStyle = NSTableViewSelectionHighlightStyleSourceList;
  labelRow.label.verticalAlignment = KBVerticalAlignmentMiddle;
  [labelRow.label setText:item font:[NSFont systemFontOfSize:14] color:[KBAppearance.currentAppearance textColor] alignment:NSLeftTextAlignment];
  return labelRow;
}

- (NSView *)outlineView:(NSOutlineView *)outlineView viewForTableColumn:(NSTableColumn *)tableColumn item:(id)item {
  KBLabel *label = [outlineView makeViewWithIdentifier:@"ColumnView" owner:self];
  if (!label) label = [[KBLabel alloc] init];
  label.verticalAlignment = KBVerticalAlignmentMiddle;
  [label setText:[item uppercaseString] font:[NSFont systemFontOfSize:12] color:[KBAppearance.currentAppearance textColor] alignment:NSLeftTextAlignment];
  return label;
}

- (CGFloat)outlineView:(NSOutlineView *)outlineView heightOfRowByItem:(id)item {
  return 26;
}

@end
