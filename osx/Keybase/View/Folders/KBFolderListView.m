//
//  KBFolderListView.m
//  Keybase
//
//  Created by Gabriel on 3/9/15.
//  Copyright (c) 2015 Gabriel Handford. All rights reserved.
//

#import "KBFolderListView.h"

#import "KBFolderView.h"
#import "KBFolder.h"

@interface KBFolderListView ()
@property NSDateFormatter *dateFormatter;
@end

@implementation KBFolderListView

- (void)viewInit {
  [super viewInit];

  self.view.rowHeight = 20;
  self.view.focusRingType = NSFocusRingTypeNone;
  self.view.usesAlternatingRowBackgroundColors = YES;
//  self.view.gridStyleMask = NSTableViewSolidHorizontalGridLineMask;
//  self.view.gridColor = KBAppearance.currentAppearance.tableGridColor;

  self.view.columnAutoresizingStyle = NSTableViewFirstColumnOnlyAutoresizingStyle;
  self.view.intercellSpacing = CGSizeZero;

  NSTableColumn *nameColumn = [[NSTableColumn alloc] initWithIdentifier:@"name"];
  nameColumn.title = @"Name";
  nameColumn.minWidth = 100;
  [self.view addTableColumn:nameColumn];
  NSTableColumn *dateColumn = [[NSTableColumn alloc] initWithIdentifier:@"dateModified"];
  dateColumn.title = @"Date Modified";
  dateColumn.minWidth = 160;
  [self.view addTableColumn:dateColumn];

  _dateFormatter = [[NSDateFormatter alloc] init];
  [_dateFormatter setDateStyle:NSDateFormatterMediumStyle];
  [_dateFormatter setTimeStyle:NSDateFormatterShortStyle];

  GHWeakSelf gself = self;
  self.viewLayout = [YOLayout layoutWithLayoutBlock:^CGSize(id<YOLayout> layout, CGSize size) {
    [layout setSize:size view:gself.scrollView options:0];
    //[layout setFrame:CGRectMake(0, -1, size.width + 1, size.height +1) view:gself.scrollView];
    return size;
  }];
}

- (NSView *)tableView:(NSTableView *)tableView viewForTableColumn:(NSTableColumn *)tableColumn row:(NSInteger)row {
  KBFolder *folder = [self.dataSource objectAtIndexPath:[NSIndexPath indexPathForItem:row inSection:0]];

  if ([tableColumn.identifier isEqualToString:@"name"]) {
    KBFolderView *folderView = [self.view makeViewWithIdentifier:@"KBFolderView" owner:self];

    if (!folderView) {
      folderView = [[KBFolderView alloc] initWithFrame:CGRectMake(0, 0, tableView.frame.size.width, 20)];
      folderView.identifier = @"KBFolderView";
    }
    [folderView setFolder:folder];
    return folderView;
  } else if ([tableColumn.identifier isEqualToString:@"dateModified"]) {
    KBLabel *label = [self.view makeViewWithIdentifier:@"KBFolderView.dateLabel" owner:self];
    if (!label) {
      label = [[KBLabel alloc] init];
      label.identifier = @"KBFolderView.dateLabel";
    }
    label.verticalAlignment = KBVerticalAlignmentMiddle;
    [label setStyle:KBLabelStyleSecondaryText appearance:KBAppearance.currentAppearance];
    [label setText:[_dateFormatter stringFromDate:folder.dateModified] font:[NSFont systemFontOfSize:13] color:KBAppearance.currentAppearance.secondaryTextColor alignment:NSLeftTextAlignment lineBreakMode:NSLineBreakByTruncatingTail];
    return label;
  }

  return nil;
}

@end
