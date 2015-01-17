//
//  KBUsersView.m
//  Keybase
//
//  Created by Gabriel on 1/8/15.
//  Copyright (c) 2015 Gabriel Handford. All rights reserved.
//

#import "KBUsersView.h"

#import "KBUserView.h"

@interface KBUsersView ()
@property NSTableView *tableView;
@end


@implementation KBUsersView

- (NSTableRowView *)tableView:(NSTableView *)tableView rowViewForRow:(NSInteger)row {

  //KBUserView *userView = [_tableView makeViewWithIdentifier:@"KBUserView" owner:self];

  return nil;
}

@end
