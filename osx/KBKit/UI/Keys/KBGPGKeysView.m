//
//  KBGPGKeysView.m
//  Keybase
//
//  Created by Gabriel on 2/17/15.
//  Copyright (c) 2015 Gabriel Handford. All rights reserved.
//

#import "KBGPGKeysView.h"

#import "KBAppearance.h"
#import "KBCellDataSource.h"

@implementation KBGPGKeysView

- (void)viewInit {
  [super viewInit];
  self.wantsLayer = YES;
  self.layer.borderColor = KBAppearance.currentAppearance.lineColor.CGColor;
  self.layer.borderWidth = 1.0;

  self.view.gridStyleMask = NSTableViewSolidHorizontalGridLineMask;
  self.view.focusRingType = NSFocusRingTypeNone;
  self.view.gridColor = KBAppearance.currentAppearance.tableGridColor;

  NSTableColumn *column1 = [[NSTableColumn alloc] initWithIdentifier:@"algorithm"];
  column1.title = @"Algorithm";
  [self.view addTableColumn:column1];
  NSTableColumn *column2 = [[NSTableColumn alloc] initWithIdentifier:@"keyID"];
  column2.title = @"Key Id";
  [self.view addTableColumn:column2];
  NSTableColumn *column3 = [[NSTableColumn alloc] initWithIdentifier:@"expiration"];
  column3.title = @"Expiration";
  [self.view addTableColumn:column3];
  NSTableColumn *column4 = [[NSTableColumn alloc] initWithIdentifier:@"identities"];
  column4.title = @"UserId";
  [self.view addTableColumn:column4];
}

- (void)setGPGKeys:(NSArray */*of KBRGPGKey*/)GPGKeys {
  [self setObjects:GPGKeys];
}

- (BOOL)tableView:(NSTableView *)aTableView shouldEditTableColumn:(NSTableColumn *)aTableColumn row:(NSInteger)rowIndex {
  return NO;
}

- (id)tableView:(NSTableView *)tableView objectValueForTableColumn:(NSTableColumn *)tableColumn row:(NSInteger)row {
  KBRGPGKey *key = [self.dataSource objectAtIndexPath:[NSIndexPath indexPathForItem:row inSection:0]];
  if ([tableColumn.identifier isEqualTo:@"algorithm"]) {
    return [key algorithm];
  } else if ([tableColumn.identifier isEqualTo:@"keyID"]) {
    return [key keyID];
  } else if ([tableColumn.identifier isEqualTo:@"expiration"]) {
    return [key expiration];
  } else if ([tableColumn.identifier isEqualTo:@"identities"]) {
    return [[[key identities] map:^(KBRPGPIdentity *i) { return NSStringWithFormat(@"%@ <%@>", i.username, i.email); }] join:@", "];
  }
  return nil;
}

- (KBRGPGKey *)selectedGPGKey {
  NSInteger selectedRow = [self.view selectedRow];
  if (selectedRow < 0) return nil;
  KBRGPGKey *key = [self.dataSource objectAtIndexPath:[NSIndexPath indexPathForItem:selectedRow inSection:0]];
  return key;
}

- (void)tableViewSelectionDidChange:(NSNotification *)notification {
  //[self.delegate GPGKeysView:self didSelectGPGKey:[notification object]];
}

@end