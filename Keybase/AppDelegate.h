//
//  AppDelegate.h
//  Keybase
//
//  Created by Gabriel on 12/11/14.
//  Copyright (c) 2014 Gabriel Handford. All rights reserved.
//

#import <Cocoa/Cocoa.h>

#import "KBRPClient.h"
#import "KBWindowController.h"
#import <KBKeybase/KBKeybase.h>
#import "KBRPC.h"

@interface AppDelegate : NSObject <NSApplicationDelegate, KBRPClientDelegate>

@property (nonatomic) KBRGetCurrentStatusRes *status;

@property (readonly) KBWindowController *windowController;
@property KBWindowController *catalogController;

+ (KBRPClient *)client;
+ (KBAPIClient *)APIClient;

+ (AppDelegate *)sharedDelegate;

- (void)checkStatus;

+ (NSString *)loadFile:(NSString *)file;

@end

