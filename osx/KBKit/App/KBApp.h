//
//  KBApp.h
//  Keybase
//
//  Created by Gabriel on 6/10/15.
//  Copyright (c) 2015 Keybase. All rights reserved.
//

#import <Foundation/Foundation.h>
#import <AppKit/AppKit.h>

@class KBApp;

@protocol KBAppDelegate <NSApplicationDelegate>
- (KBApp *)app;
- (BOOL)setError:(NSError *)error sender:(NSView *)sender;
- (id)preferencesValueForIdentifier:(NSString *)identifier;
- (BOOL)setPrefencesValue:(id)value forIdentifier:(NSString *)identifier synchronize:(BOOL)synchronize;
@end

@interface KBApp : NSObject

// App instance if present as a property of the NSApplicationDelegate
+ (instancetype)app;

- (void)open;

- (IBAction)preferences:(id)sender;
- (IBAction)quit:(id)sender;
- (IBAction)logout:(id)sender;

- (void)quitWithPrompt:(BOOL)prompt sender:(id)sender;

- (NSString *)currentUsername;
- (NSString *)APIURLString:(NSString *)path;

- (BOOL)setError:(NSError *)error sender:(NSView *)sender;
- (BOOL)setError:(NSError *)error sender:(NSView *)sender completion:(void (^)(NSModalResponse returnCode))completion;

@end
