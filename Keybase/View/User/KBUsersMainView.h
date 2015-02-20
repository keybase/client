//
//  KBUsersMainView.h
//  Keybase
//
//  Created by Gabriel on 2/6/15.
//  Copyright (c) 2015 Gabriel Handford. All rights reserved.
//

#import <Foundation/Foundation.h>

#import "KBAppKit.h"
#import "KBRPC.h"
#import "KBUsersView.h"

@interface KBUsersMainView : YONSView <KBUsersViewDelegate, NSTextFieldDelegate>

- (void)setUser:(KBRUser *)user;

@end
