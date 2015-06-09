//
//  KBAppView.h
//  Keybase
//
//  Created by Gabriel on 2/4/15.
//  Copyright (c) 2015 Gabriel Handford. All rights reserved.
//

#import <Foundation/Foundation.h>

#import "KBAppDefines.h"
#import "KBRPC.h"
#import "KBEnvironment.h"

@class KBAppView;

@protocol KBAppViewDelegate
- (void)appViewDidUpdateStatus:(KBAppView *)appView;
@end

@interface KBAppView : YOView <KBComponent>

@property (nonatomic) KBRUser *user;
@property (readonly) KBEnvironment *environment;
@property (weak) id<KBAppViewDelegate> delegate;

- (void)openWithEnvironment:(KBEnvironment *)environment;

- (KBWindow *)openWindow;

- (void)showLogin;
- (void)logout:(BOOL)prompt;

- (void)showInProgress:(NSString *)title;
- (void)checkStatus;

- (NSString *)APIURLString:(NSString *)path;

@end


@interface KBAppView (AppDelegate)
- (void)quitWithPrompt:(BOOL)prompt sender:(id)sender;
- (BOOL)setError:(NSError *)error sender:(NSView *)sender completion:(void (^)(NSModalResponse returnCode))completion;
@end
