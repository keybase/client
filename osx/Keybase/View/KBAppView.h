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
- (void)appView:(KBAppView *)appView didLaunchWithClient:(KBRPClient *)client;
- (void)appView:(KBAppView *)appView didCheckInstallWithClient:(KBRPClient *)client;
- (void)appView:(KBAppView *)appView willConnectWithClient:(KBRPClient *)client;
- (void)appView:(KBAppView *)appView didConnectWithClient:(KBRPClient *)client;
- (void)appView:(KBAppView *)appView didCheckStatusWithClient:(KBRPClient *)client config:(KBRConfig *)config status:(KBRGetCurrentStatusRes *)status;
- (void)appView:(KBAppView *)appView didDisconnectWithClient:(KBRPClient *)client;
- (void)appView:(KBAppView *)appView didLogMessage:(NSString *)message;
@end

@interface KBAppView : YOView <NSWindowDelegate, KBSourceOutlineViewDelegate, KBSignupViewDelegate, KBLoginViewDelegate, KBRPClientDelegate> //, NSWindowRestoration>

@property KBRPClient * client;

@property (weak) id<KBAppViewDelegate> delegate;

@property (nonatomic) KBRUser *user;
@property (nonatomic, getter=isProgressEnabled) BOOL progressEnabled;

- (void)connect:(KBRPClient *)client;

- (KBWindow *)openWindow;

- (void)logout;

- (void)checkStatus:(KBCompletionBlock)completion;

@end
