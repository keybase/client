//
//  KBUserProfileView.h
//  Keybase
//
//  Created by Gabriel on 1/12/15.
//  Copyright (c) 2015 Gabriel Handford. All rights reserved.
//

#import <Foundation/Foundation.h>

#import "KBUIDefines.h"
#import "KBUser.h"

@interface KBUserProfileView : KBView

- (void)loadUID:(NSString *)UID;

- (void)setUser:(KBUser *)user;

@end
