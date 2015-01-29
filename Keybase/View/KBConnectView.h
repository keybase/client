//
//  KBConnectView.h
//  Keybase
//
//  Created by Gabriel on 1/12/15.
//  Copyright (c) 2015 Gabriel Handford. All rights reserved.
//

#import <Foundation/Foundation.h>

#import "KBUIDefines.h"
#import "KBRPC.h"

@class KBSignupView;
@class KBLoginView;

@protocol KBLoginViewDelegate
- (void)loginView:(KBLoginView *)loginView didLoginWithStatus:(KBRGetCurrentStatusRes *)status;
@end

@protocol KBSignupViewDelegate
- (void)signupView:(KBSignupView *)signupView didSignupWithStatus:(KBRGetCurrentStatusRes *)status;
@end

@interface KBConnectView : KBNavigationView

@property (readonly) KBLoginView *loginView;
@property (readonly) KBSignupView *signupView;

- (void)showLogin:(BOOL)animated;
- (void)showSignup:(BOOL)animated;
@end

@interface KBLoginView : KBView
@property (weak) id<KBLoginViewDelegate> delegate;
@end

@interface KBSignupView : KBView
@property (weak) id<KBSignupViewDelegate> delegate;
@end