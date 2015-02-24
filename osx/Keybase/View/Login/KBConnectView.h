//
//  KBConnectView.h
//  Keybase
//
//  Created by Gabriel on 1/12/15.
//  Copyright (c) 2015 Gabriel Handford. All rights reserved.
//

#import <Foundation/Foundation.h>

#import "KBAppKit.h"
#import "KBRPC.h"
#import "KBLoginView.h"
#import "KBSignupView.h"

@interface KBConnectView : YONSView

@property KBNavigationView *navigation;
@property (readonly) KBLoginView *loginView;
@property (readonly) KBSignupView *signupView;

- (void)openWindow:(NSString *)title;

- (void)setUser:(KBRUser *)user;

- (void)showLogin:(BOOL)animated;
- (void)showSignup:(BOOL)animated;
@end

