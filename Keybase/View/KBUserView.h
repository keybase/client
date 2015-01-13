//
//  KBUserView.h
//  Keybase
//
//  Created by Gabriel on 1/7/15.
//  Copyright (c) 2015 Gabriel Handford. All rights reserved.
//

#import <Foundation/Foundation.h>
#import <AppKit/AppKit.h>

#import "KBView.h"
#import <KBKeybase/KBUser.h>

@interface KBUserView : KBView

- (void)setUser:(KBUser *)user;

@end
