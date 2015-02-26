//
//  AppDelegate.h
//  Keybase
//
//  Created by Gabriel on 12/11/14.
//  Copyright (c) 2014 Gabriel Handford. All rights reserved.
//

#import <Cocoa/Cocoa.h>

#import "KBRPClient.h"
#import <KBKeybase/KBKeybase.h>
#import "KBRPC.h"
#import "KBConnectView.h"
#import "KBAppView.h"
#import <GHKit/GHKit.h>

@interface AppDelegate : NSObject <NSApplicationDelegate, KBRPClientDelegate, KBSignupViewDelegate, KBLoginViewDelegate>

@property (nonatomic) KBRGetCurrentStatusRes *status;

+ (KBRPClient *)client;
+ (KBAPIClient *)APIClient;
+ (KBAppView *)appView;

+ (AppDelegate *)sharedDelegate;

- (void)checkStatus;

+ (void)setError:(NSError *)error sender:(NSView *)sender;
+ (void)setInProgress:(BOOL)inProgress view:(NSView *)view;
- (void)setFatalError:(NSError *)error;

+ (NSString *)bundleFile:(NSString *)file;

+ (NSString *)applicationSupport:(NSArray *)subdirs create:(BOOL)create error:(NSError **)error;

#pragma mark Debug

- (void)openCatalog;

@end

