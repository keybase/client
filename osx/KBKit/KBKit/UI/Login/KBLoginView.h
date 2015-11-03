//
//  KBLoginView.h
//  Keybase
//
//  Created by Gabriel on 2/9/15.
//  Copyright (c) 2015 Gabriel Handford. All rights reserved.
//

#import <Foundation/Foundation.h>

#import <Tikppa/Tikppa.h>
#import "KBRPC.h"
#import <Tikppa/Tikppa.h>
#import "KBRPC.h"

@class KBLoginView;

@protocol KBLoginViewDelegate
- (void)loginViewDidLogin:(KBLoginView *)loginView;
@end

@interface KBLoginView : YOView

@property KBNavigationView *navigation;
@property KBRPClient *client;
@property (weak) id<KBLoginViewDelegate> delegate;

@property KBTextField *usernameField;
@property KBButton *loginButton;
@property KBButton *signupButton;

- (void)viewDidAppear:(BOOL)animated;

- (void)setUsername:(NSString *)username;

//- (void)selectSigner:(KBRSelectSignerRequestParams *)params completion:(MPRequestCompletion)completion;

@end
