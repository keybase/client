//
//  KBSignupView.h
//  Keybase
//
//  Created by Gabriel on 2/9/15.
//  Copyright (c) 2015 Gabriel Handford. All rights reserved.
//

#import <Foundation/Foundation.h>


#import "KBRPC.h"
#import <Tikppa/Tikppa.h>
#import "KBRPC.h"

typedef void (^KBSignUpCompletion)(id sender);

@class KBSignupView;

@protocol KBSignupViewDelegate
- (void)signupViewDidSignup:(KBSignupView *)signupView;
@end


@interface KBSignupView : YOView

@property KBNavigationView *navigation;
@property KBRPClient *client;
@property (weak) id<KBSignupViewDelegate> delegate;

@property (copy) KBSignUpCompletion completion;

@property KBTextField *emailField;
@property KBTextField *usernameField;
@property KBTextField *deviceNameField;

@property KBButton *loginButton;
@property KBButton *signupButton;

- (void)viewDidAppear:(BOOL)animated;

@end
