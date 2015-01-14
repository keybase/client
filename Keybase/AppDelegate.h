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

@property (nonatomic) KBGetCurrentStatusRes *status;

@property (readonly) KBWindowController *windowController;

+ (KBRPClient *)client;
+ (KBAPIClient *)APIClient;

+ (AppDelegate *)sharedDelegate;

- (void)passwordPrompt:(NSString *)prompt description:(NSString *)description completion:(void (^)(BOOL canceled, NSString *password))completion;

@end

