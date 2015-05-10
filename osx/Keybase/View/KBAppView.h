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


@class KBAppView;

@protocol KBAppViewDelegate
- (void)appViewDidLaunch:(KBAppView *)appView;
- (void)appView:(KBAppView *)appView willConnectWithClient:(KBRPClient *)client;
- (void)appView:(KBAppView *)appView didConnectWithClient:(KBRPClient *)client;
- (void)appView:(KBAppView *)appView didCheckStatusWithConfig:(KBRConfig *)config status:(KBRGetCurrentStatusRes *)status;
- (void)appView:(KBAppView *)appView didDisconnectWithClient:(KBRPClient *)client;
- (void)appView:(KBAppView *)appView didErrorOnConnect:(NSError *)error connectAttempt:(NSInteger)connectAttempt;
- (void)appView:(KBAppView *)appView didLogMessage:(NSString *)message;

- (void)appViewDidUpdateStatus:(KBAppView *)appView;
@end

@interface KBAppView : YOView

@property KBRPClient *client;

@property (readonly) NSHashTable *delegates;

@property (nonatomic) KBRUser *user;
@property (readonly, nonatomic) KBRGetCurrentStatusRes *status;
@property (readonly, nonatomic) KBRConfig *config;

- (void)openWithEnvironment:(KBEnvironment *)environment client:(KBRPClient *)client;

- (KBWindow *)openWindow;

- (void)showLogin;
- (void)logout:(BOOL)prompt;

- (void)showInProgress:(NSString *)title;
- (void)checkStatus:(KBCompletion)completion;

- (NSString *)APIURLString:(NSString *)path;

@end
