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

@interface AppDelegate : NSObject <NSApplicationDelegate, KBRPClientDelegate, KBSignupViewDelegate, KBLoginViewDelegate>

@property (nonatomic) KBRGetCurrentStatusRes *status;

+ (KBRPClient *)client;
+ (KBAPIClient *)APIClient;

+ (AppDelegate *)sharedDelegate;

- (void)checkStatus;

+ (void)setError:(NSError *)error sender:(NSView *)sender;
+ (void)setInProgress:(BOOL)inProgress view:(NSView *)view;

+ (NSString *)loadFile:(NSString *)file;

#pragma mark Debug

- (void)openCatalog;

@end

