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
#import "KBRPC.h"

@class KBUsersView;

@protocol KBUsersViewDelegate <NSObject>
- (void)usersView:(KBUsersView *)usersView didSelectUser:(KBRUser *)user;
@end

@interface KBUsersView : KBTableView

@property (weak) id<KBUsersViewDelegate> delegate;

- (void)setUsers:(NSArray *)users;

@end
