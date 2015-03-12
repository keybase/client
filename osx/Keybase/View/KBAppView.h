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

@class KBAppView;

@protocol KBAppViewDelegate
- (void)appView:(KBAppView *)appView willConnectWithClient:(id<KBRPClient>)client;
- (void)appView:(KBAppView *)appView didConnectWithClient:(id<KBRPClient>)client config:(KBRConfig *)config;
- (void)appView:(KBAppView *)appView didDisconnectWithClient:(id<KBRPClient>)client;
- (void)appView:(KBAppView *)appView didLogMessage:(NSString *)message;
@end

@interface KBAppView : YONSView <NSWindowDelegate, KBSourceOutlineViewDelegate, KBSignupViewDelegate, KBLoginViewDelegate, KBRPClientDelegate> //, NSWindowRestoration>

@property id<KBRPClient> client;

@property (weak) id<KBAppViewDelegate> delegate;

@property (nonatomic) KBRUser *user;
@property (nonatomic, getter=isProgressEnabled) BOOL progressEnabled;

- (void)connect:(id<KBRPClient>)client;

- (KBWindow *)openWindow;

- (void)logout;

@end
