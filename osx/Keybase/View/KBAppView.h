//
//  KBAppView.h
//  Keybase
//
//  Created by Gabriel on 2/4/15.
//  Copyright (c) 2015 Gabriel Handford. All rights reserved.
//

#import <Foundation/Foundation.h>

#import "KBAppKit.h"
#import "KBRPC.h"
#import "KBSourceOutlineView.h"
#import "KBSignupView.h"
#import "KBLoginView.h"

@interface KBAppView : YONSView <NSWindowDelegate, KBSourceOutlineViewDelegate, KBSignupViewDelegate, KBLoginViewDelegate, KBRPClientDelegate> //, NSWindowRestoration>

@property (readonly) KBRPClient *client;
@property (nonatomic) KBRUser *user;
@property (nonatomic, getter=isProgressEnabled) BOOL progressEnabled;

- (void)connect;

- (void)openWindow;

- (void)logout;

@end
