//
//  KBCatalogView.m
//  Keybase
//
//  Created by Gabriel on 1/16/15.
//  Copyright (c) 2015 Gabriel Handford. All rights reserved.
//

#import "KBCatalogView.h"
#import "AppDelegate.h"

@interface KBCatalogView ()
@property NSMutableArray *items;

@property NSScrollView *scrollView;
@property NSTableView *tableView;
@end

@implementation KBCatalogView

- (void)viewInit {
  [super viewInit];
  _items = [NSMutableArray array];

  [_items addObject:@"Login"];
  [_items addObject:@"Signup"];
  [_items addObject:@"KeyGen"];

  _scrollView = [[NSScrollView alloc] init];
  [self addSubview:_scrollView];

  _tableView = [[NSTableView alloc] init];
  _tableView.dataSource = self;
  _tableView.delegate = self;
  _tableView.rowHeight = 40;
  _tableView.rowSizeStyle = NSTableViewRowSizeStyleCustom;
  [_tableView setHeaderView:nil];

  NSTableColumn *column1 = [[NSTableColumn alloc] initWithIdentifier:@""];
  //[column1 setWidth:360];
  [_tableView addTableColumn:column1];

  [_scrollView setDocumentView:_tableView];

  [self.tableView reloadData];

  YOSelf yself = self;
  self.viewLayout = [YOLayout layoutWithLayoutBlock:^(id<YOLayout> layout, CGSize size) {
    [layout setSize:size view:yself.scrollView];
    return size;
  }];
}

- (NSInteger)numberOfRowsInTableView:(NSTableView *)tableView {
  return [_items count];
}

//- (NSTableRowView *)tableView:(NSTableView *)tableView rowViewForRow:(NSInteger)row {
//  NSTableRowView *rowView = [[NSTableRowView alloc] init];
//  return rowView;
//}

- (NSView *)tableView:(NSTableView *)tableView viewForTableColumn:(NSTableColumn *)tableColumn row:(NSInteger)row {
  NSString *label = [_items objectAtIndex:row];

  KBTextLabel *view = [_tableView makeViewWithIdentifier:@"text" owner:self];
  //KBButton *view = [_tableView makeViewWithIdentifier:@"link" owner:self];
  if (!view) {
    //view = [KBButton buttonAsLinkWithText:nil];
    view = [[KBTextLabel alloc] init];
    view.identifier = @"text";
  }
  //view.text = label;
  [view setText:label font:[NSFont systemFontOfSize:24] color:[KBLookAndFeel textColor] alignment:NSCenterTextAlignment];
  view.frame = CGRectMake(0, 0, self.tableView.frame.size.width, 40);
  [view sizeToFit];

  return view;
}

- (void)tableViewSelectionDidChange:(NSNotification *)notification {
  NSTableView *tableView = notification.object;

  if (tableView.selectedRow >= 0) {
    NSString *label = [_items objectAtIndex:tableView.selectedRow];
#pragma clang diagnostic push
#pragma clang diagnostic ignored "-Warc-performSelector-leaks"
    [AppDelegate.sharedDelegate.catalogController performSelector:NSSelectorFromString(NSStringWithFormat(@"show%@:", label))];
#pragma clang diagnostic pop
  }

  [tableView deselectAll:nil];
}

//- (CGFloat)tableView:(NSTableView *)tableView heightOfRow:(NSInteger)row {
//  return 50;
//}

@end
