//
//  AppDelegate.h
//  Keybase
//
//  Created by Gabriel on 12/11/14.
//  Copyright (c) 2014 Gabriel Handford. All rights reserved.
//

#import <Cocoa/Cocoa.h>

#import "KBRPClient.h"
#import "KBRPC.h"
#import "KBAppView.h"
#import <GHKit/GHKit.h>
#import "KBAppDefines.h"
#import "KBControlPanel.h"
#import "KBConsoleView.h"

@interface AppDelegate : NSObject <NSApplicationDelegate>

@property (readonly) KBControlPanel *controlPanel;

+ (KBAppView *)appView;

+ (AppDelegate *)sharedDelegate;

- (IBAction)preferences:(id)sender;
- (IBAction)quit:(id)sender;
- (IBAction)logout:(id)sender;

- (void)quitWithPrompt:(BOOL)prompt sender:(id)sender;

+ (BOOL)setError:(NSError *)error sender:(NSView *)sender;
+ (BOOL)setError:(NSError *)error sender:(NSView *)sender completion:(void (^)(NSModalResponse returnCode))completion;

+ (NSString *)bundleFile:(NSString *)file;

+ (NSString *)applicationSupport:(NSArray *)subdirs create:(BOOL)create error:(NSError **)error;

- (void)openURLString:(NSString *)URLString sender:(NSView *)sender;

+ (dispatch_block_t)openSheetWithView:(NSView *)view size:(CGSize)size sender:(NSView *)sender closeButton:(KBButton *)closeButton;

@end
