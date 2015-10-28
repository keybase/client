//
//  KBUserView.h
//  Keybase
//
//  Created by Gabriel on 1/7/15.
//  Copyright (c) 2015 Gabriel Handford. All rights reserved.
//

#import <Foundation/Foundation.h>

#import <Tikppa/Tikppa.h>
#import "KBRPC.h"

@interface KBUserView : KBImageTextView

- (void)setUser:(KBRUser *)user;

- (void)setUserSummary:(KBRUserSummary *)userSummary;

@end


@interface KBUserCell : KBUserView
@end