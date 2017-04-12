//
//  KBAppView.h
//  Keybase
//
//  Created by Gabriel on 2/4/15.
//  Copyright (c) 2015 Gabriel Handford. All rights reserved.
//

#import <Foundation/Foundation.h>

#import <Tikppa/Tikppa.h>

#import <KBKit/KBDefines.h>
#import <KBKit/KBEnvironment.h>
#import <KBKit/KBRPC.h>

@interface KBAppView : YOView

@property (readonly) KBEnvironment *environment;
@property (nonatomic, readonly) KBRGetCurrentStatusRes *userStatus;

- (void)openWithEnvironment:(KBEnvironment *)environment completion:(KBCompletion)completion;

- (void)openWindow;

- (void)showLogin;
- (void)logout:(BOOL)prompt;

- (void)showInProgress:(NSString *)title;
- (void)checkStatus;

- (void)showInstallStatusView:(KBCompletion)completion;

- (NSString *)APIURLString:(NSString *)path;

@end


@interface KBAppView (AppDelegate)
- (void)quitWithPrompt:(BOOL)prompt sender:(id)sender;
- (BOOL)setError:(NSError *)error sender:(NSView *)sender completion:(void (^)(KBErrorResponse response))completion;
@end
