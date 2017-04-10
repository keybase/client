//
//  KBFolderUsersListView.m
//  Keybase
//
//  Created by Gabriel on 4/30/15.
//  Copyright (c) 2015 Gabriel Handford. All rights reserved.
//

#import "KBFolderUsersListView.h"

#import "KBUserPermission.h"
#import "KBUserImageView.h"

@interface KBFolderUsersListView ()
@end

@implementation KBFolderUsersListView

- (void)viewInit {
  [super viewInit];

  self.scrollView.borderType = NSBezelBorder;
  self.view.focusRingType = NSFocusRingTypeNone;

  self.view.usesAlternatingRowBackgroundColors = YES;
  self.view.columnAutoresizingStyle = NSTableViewFirstColumnOnlyAutoresizingStyle;
  self.view.intercellSpacing = CGSizeZero;

  NSTableColumn *nameColumn = [[NSTableColumn alloc] initWithIdentifier:@"name"];
  nameColumn.title = @"Name";
  nameColumn.minWidth = 100;
  [self.view addTableColumn:nameColumn];
  NSTableColumn *permissionColumn = [[NSTableColumn alloc] initWithIdentifier:@"permission"];
  permissionColumn.title = @"Permissions";
  permissionColumn.minWidth = 160;
  [self.view addTableColumn:permissionColumn];

  self.view.rowHeight = 32;

  KBUserPermission *test = [[KBUserPermission alloc] init];
  test.user = [[KBRUser alloc] init];
  test.user.username = @"t_alice";
  test.permission = @"Read only";
  [self.dataSource addObjects:@[test]];
  [self reloadData];
}

- (NSView *)tableView:(NSTableView *)tableView viewForTableColumn:(NSTableColumn *)tableColumn row:(NSInteger)row {
  KBUserPermission *userPermission = [self.dataSource objectAtIndexPath:[NSIndexPath indexPathForItem:row inSection:0]];

  if ([tableColumn.identifier isEqualToString:@"name"]) {
    NSString *identifier = @"KBFolderUsersListView.name";
    KBUserPermissionLabel *view = [self.view makeViewWithIdentifier:identifier owner:self];
    if (!view) {
      view = [[KBUserPermissionLabel alloc] initWithFrame:CGRectMake(0, 0, tableView.frame.size.width, 40)];
      view.identifier = identifier;
    }
    view.style = KBImageLabelStyleLarge;
    [view setUserPermission:userPermission];
    return view;
  } else if ([tableColumn.identifier isEqualToString:@"permission"]) {

    NSPopUpButton *button = [[NSPopUpButton alloc] initWithFrame:CGRectMake(0, 0, 160, 20) pullsDown:NO];
    button.bordered = NO;
    button.font = [KBImageLabel fontForStyle:KBImageLabelStyleLarge];
    [button addItemsWithTitles:@[@"Read only", @"Write"]];
    [button selectItemAtIndex:0];
    return button;
  } else {
    NSAssert(NO, @"Unhandled table column");
    return nil;
  }
}

@end


@implementation KBUserPermissionLabel

- (void)viewInit {
  [super viewInit];
  self.imageView.roundedRatio = 1.0;
}

- (void)setUserPermission:(KBUserPermission *)userPermission {
  [self.nameLabel setText:userPermission.user.username font:[self.class fontForStyle:self.style] color:KBAppearance.currentAppearance.textColor alignment:NSLeftTextAlignment lineBreakMode:NSLineBreakByTruncatingTail];
  [self.imageView kb_setUsername:userPermission.user.username];
  [self setNeedsLayout];
}

@end
