//
//  AppDelegate.h
//  Keybase
//
//  Created by Gabriel on 12/11/14.
//  Copyright (c) 2014 Gabriel Handford. All rights reserved.
//

#import <Cocoa/Cocoa.h>

#import "KBRPClient.h"
#import "KBConnectWindowController.h"
#import <KBKeybase/KBKeybase.h>

@interface AppDelegate : NSObject <NSApplicationDelegate>

@property (readonly) NSString *username;

+ (KBRPClient *)client;
+ (KBAPIClient *)APIClient;

+ (AppDelegate *)sharedDelegate;

- (void)setConnected:(BOOL)loggedIn hasKey:(BOOL)hasKey username:(NSString *)username;

@end

