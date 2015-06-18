//
//  KBFolderListView.m
//  Keybase
//
//  Created by Gabriel on 3/9/15.
//  Copyright (c) 2015 Gabriel Handford. All rights reserved.
//

#import "KBFileListView.h"

#import "KBFileLabel.h"
#import "KBFile.h"

@interface KBFileListView ()
@property NSDateFormatter *dateFormatter;
@end

@implementation KBFileListView

- (void)viewInit {
  [super viewInit];

  self.view.focusRingType = NSFocusRingTypeNone;

  self.view.usesAlternatingRowBackgroundColors = YES;
  self.view.columnAutoresizingStyle = NSTableViewFirstColumnOnlyAutoresizingStyle;
  self.view.intercellSpacing = CGSizeZero;

  [self.view setHeaderView:nil];

  [self setFileColumnStyle:KBFileColumnStyleName];
  [self setImageLabelStyle:KBImageLabelStyleDefault];

  _dateFormatter = [[NSDateFormatter alloc] init];
  [_dateFormatter setDateStyle:NSDateFormatterMediumStyle];
  [_dateFormatter setTimeStyle:NSDateFormatterShortStyle];
}

- (void)setFileColumnStyle:(KBFileColumnStyle)fileColumnStyle {
  [self removeAllTableColumns];
  switch (fileColumnStyle) {
    case KBFileColumnStyleNameDate: {
      NSTableColumn *nameColumn = [[NSTableColumn alloc] initWithIdentifier:@"name"];
      nameColumn.title = @"Name";
      nameColumn.minWidth = 100;
      [self.view addTableColumn:nameColumn];
      NSTableColumn *dateColumn = [[NSTableColumn alloc] initWithIdentifier:@"dateModified"];
      dateColumn.title = @"Date Modified";
      dateColumn.minWidth = 160;
      [self.view addTableColumn:dateColumn];
      break;
    }
    case KBFileColumnStyleName: {
      NSTableColumn *nameColumn = [[NSTableColumn alloc] initWithIdentifier:@"name"];
      nameColumn.title = @"";
      [self.view addTableColumn:nameColumn];
      break;
    }
  }
}

- (void)setImageLabelStyle:(KBImageLabelStyle)imageLabelStyle {
  _imageLabelStyle = imageLabelStyle;
  switch (_imageLabelStyle) {
    case KBImageLabelStyleDefault:
      self.view.rowHeight = 20;
      break;

    case KBImageLabelStyleLarge:
      self.view.rowHeight = 32;
      break;
  }
  [self reloadData];
}

- (NSView *)tableView:(NSTableView *)tableView viewForTableColumn:(NSTableColumn *)tableColumn row:(NSInteger)row {
  KBFile *file = [self.dataSource objectAtIndexPath:[NSIndexPath indexPathForItem:row inSection:0]];

  if ([tableColumn.identifier isEqualToString:@"name"]) {
    KBFileLabel *fileView = [self.view makeViewWithIdentifier:@"KBFileListView.name" owner:self];
    if (!fileView) {
      fileView = [[KBFileLabel alloc] initWithFrame:CGRectMake(0, 0, tableView.frame.size.width, 40)];
      fileView.identifier = @"KBFileListView.name";
      fileView.style = _imageLabelStyle;
    }
    [fileView setFile:file];
    return fileView;
  } else if ([tableColumn.identifier isEqualToString:@"dateModified"]) {
    KBLabel *label = [self.view makeViewWithIdentifier:@"KBFileListView.dateLabel" owner:self];
    if (!label) {
      label = [[KBLabel alloc] init];
      label.identifier = @"KBFileListView.dateLabel";
    }
    label.verticalAlignment = KBVerticalAlignmentMiddle;
    [label setText:[_dateFormatter stringFromDate:file.dateModified] font:[KBFileLabel fontForStyle:self.imageLabelStyle] color:KBAppearance.currentAppearance.secondaryTextColor alignment:NSLeftTextAlignment lineBreakMode:NSLineBreakByTruncatingTail];
    return label;
  } else {
    NSAssert(NO, @"Unhandled table column");
  }

  return nil;
}

@end
