//
//  KBUsersView.h
//  Keybase
//
//  Created by Gabriel on 1/8/15.
//  Copyright (c) 2015 Gabriel Handford. All rights reserved.
//

#import <Foundation/Foundation.h>

#import "KBUIDefines.h"
#import "KBTableView.h"

@interface KBUsersView : KBTableView

@property KBNavigationView *navigation;

- (void)loadUsernames:(NSArray *)usernames;

@end
