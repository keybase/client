//
//  KBSignupView.h
//  Keybase
//
//  Created by Gabriel on 2/9/15.
//  Copyright (c) 2015 Gabriel Handford. All rights reserved.
//

#import <Foundation/Foundation.h>

#import "KBUIDefines.h"
#import "KBRPC.h"

@class KBSignupView;

@protocol KBSignupViewDelegate
- (void)signupView:(KBSignupView *)signupView didSignupWithStatus:(KBRGetCurrentStatusRes *)status;
@end


@interface KBSignupView : YONSView <NSTextFieldDelegate>
@property KBNavigationView *navigation;
@property (weak) id<KBSignupViewDelegate> delegate;

@property KBTextField *emailField;
@property KBTextField *usernameField;
@property KBTextField *deviceNameField;

@property KBButton *loginButton;
@property KBButton *signupButton;

- (void)viewDidAppear:(BOOL)animated;

@end
