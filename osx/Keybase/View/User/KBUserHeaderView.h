//
//  KBUserHeaderView.h
//  Keybase
//
//  Created by Gabriel on 1/9/15.
//  Copyright (c) 2015 Gabriel Handford. All rights reserved.
//

#import <Foundation/Foundation.h>

#import "KBAppKit.h"
#import "KBRPC.h"
#import "KBUser.h"

@interface KBUserHeaderView : YONSView

- (void)setUser:(KBRUser *)user;

- (void)setProgressEnabled:(BOOL)progressEnabled;

@end
