//
//  KBUsersMainView.h
//  Keybase
//
//  Created by Gabriel on 2/6/15.
//  Copyright (c) 2015 Gabriel Handford. All rights reserved.
//

#import <Foundation/Foundation.h>

#import "KBUIDefines.h"
#import "KBRPC.h"
#import "KBUsersView.h"

@interface KBUsersMainView : YONSView <KBUsersViewDelegate>

- (void)setUser:(KBRUser *)user;

@end
