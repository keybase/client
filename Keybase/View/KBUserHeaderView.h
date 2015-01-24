//
//  KBUserHeaderView.h
//  Keybase
//
//  Created by Gabriel on 1/9/15.
//  Copyright (c) 2015 Gabriel Handford. All rights reserved.
//

#import <Foundation/Foundation.h>

#import "KBUIDefines.h"
#import "KBRPC.h"
#import "KBUser.h"

@interface KBUserHeaderView : KBView

- (void)setUser:(KBRUser *)user;

- (void)setUserInfo:(KBUser *)user;

@end
