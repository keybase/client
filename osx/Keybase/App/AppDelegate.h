//
//  AppDelegate.h
//  Keybase
//
//  Created by Gabriel on 12/11/14.
//  Copyright (c) 2014 Gabriel Handford. All rights reserved.
//

#import <Cocoa/Cocoa.h>

#import <KBApp/KBAppView.h>

@interface AppDelegate : NSObject <NSApplicationDelegate>

- (NSString *)currentUsername;
- (NSString *)APIURLString:(NSString *)path;

+ (KBAppView *)appView;

- (IBAction)preferences:(id)sender;
- (IBAction)quit:(id)sender;
- (IBAction)logout:(id)sender;

- (void)quitWithPrompt:(BOOL)prompt sender:(id)sender;

+ (BOOL)setError:(NSError *)error sender:(NSView *)sender;
+ (BOOL)setError:(NSError *)error sender:(NSView *)sender completion:(void (^)(NSModalResponse returnCode))completion;

@end
