//
//  KBApp.h
//  Keybase
//
//  Created by Gabriel on 6/10/15.
//  Copyright (c) 2017 Keybase. All rights reserved.
//

#import <Foundation/Foundation.h>
#import <AppKit/AppKit.h>

#import <KBKit/KBAppView.h>
#import <KBKit/KBPreferences.h>
#import <KBKit/KBEnvironment.h>
#import <KBKit/KBService.h>

@class KBApp;

@protocol KBAppDelegate <NSApplicationDelegate>
- (KBApp *)app;
- (BOOL)setError:(NSError *)error sender:(id)sender completion:(void (^)(NSModalResponse response))completion;
- (id)preferencesValueForIdentifier:(NSString *)identifier;
- (BOOL)setPrefencesValue:(id)value forIdentifier:(NSString *)identifier synchronize:(BOOL)synchronize;
@end

@interface KBApp : NSObject

@property (readonly) KBAppView *appView;
@property (readonly) KBPreferences *preferences;

// App instance if present as a property of the NSApplicationDelegate
+ (instancetype)app;

+ (KBEnvironment *)environment;

- (void)open;

- (void)openControlPanel;

- (NSWindow *)mainWindow;

- (KBService *)service;

- (void)quitWithPrompt:(BOOL)prompt sender:(id)sender;

- (NSString *)currentUsername;
- (NSString *)APIURLString:(NSString *)path;

- (BOOL)setError:(NSError *)error sender:(id)sender completion:(void (^)(NSModalResponse response))completion;

#pragma mark Menu Actions

- (IBAction)encrypt:(id)sender;
- (IBAction)encryptFile:(id)sender;
- (IBAction)decrypt:(id)sender;
- (IBAction)decryptFile:(id)sender;
- (IBAction)sign:(id)sender;
- (IBAction)signFile:(id)sender;
- (IBAction)signFiles:(id)sender;
- (IBAction)verify:(id)sender;
- (IBAction)verifyFile:(id)sender;

@end
