//
//  AppDelegate.m
//  Keybase
//
//  Created by Gabriel on 12/11/14.
//  Copyright (c) 2014 Gabriel Handford. All rights reserved.
//

#import "AppDelegate.h"

#import "KBPGPKeyGenView.h"
#import "KBRPC.h"
#import "KBUserProfileView.h"
#import "KBMockViews.h"
#import "KBPreferences.h"
#import "KBFatalErrorView.h"
#import "KBAppearance.h"
#import "KBInstaller.h"
#import "KBConsoleView.h"

@interface AppDelegate ()
@property KBAppView *appView;
@property KBPreferences *preferences;
@property BOOL alerting;

// Debug
@property KBConsoleView *consoleView;
@property KBMockViews *mockViews;
@end

@implementation AppDelegate

- (void)applicationDidFinishLaunching:(NSNotification *)notification {
  [KBAppearance setCurrentAppearance:KBAppearance.lightAppearance];

  _appView = [[KBAppView alloc] init];
  _appView.delegate = self;
  KBWindow *window = [_appView openWindow];

  _consoleView = [[KBConsoleView alloc] init];
  [window addChildWindowForView:_consoleView size:CGSizeMake(400, 400) position:KBWindowPositionRight title:@"Console"];

  _mockViews = [[KBMockViews alloc] init];
  [window addChildWindowForView:_mockViews size:CGSizeMake(400, 300) position:KBWindowPositionRight title:@"Mocks"];

  KBRPClient *client = [[KBRPClient alloc] init];
  [_appView connect:client];

}

- (void)applicationWillTerminate:(NSNotification *)notification {

}

- (BOOL)applicationShouldTerminateAfterLastWindowClosed:(NSApplication *)application {
  return NO;
}

- (void)appView:(KBAppView *)appView willConnectWithClient:(id<KBRPClient>)client {
  _consoleView.debugStatusView.client = client;
  [_consoleView.debugStatusView setRPCConnected:NO serverConnected:NO];
  [_consoleView setNeedsLayout];
}

- (void)appView:(KBAppView *)appView didConnectWithClient:(id<KBRPClient>)client config:(KBRConfig *)config {
  _consoleView.debugStatusView.config = config;
  [_consoleView.debugStatusView setRPCConnected:YES serverConnected:YES]; // TODO server connected status
  [_consoleView setNeedsLayout];
}

- (void)appView:(KBAppView *)appView didLogMessage:(NSString *)message {
  [_consoleView log:message];
}

- (void)appView:(KBAppView *)appView didDisconnectWithClient:(id<KBRPClient>)client {
  [_consoleView.debugStatusView setRPCConnected:NO serverConnected:NO];
  [_consoleView setNeedsLayout];
}

+ (KBAppView *)appView {
  return ((AppDelegate *)[NSApp delegate]).appView;
}

+ (AppDelegate *)sharedDelegate {
  return (AppDelegate *)[[NSApplication sharedApplication] delegate];
}

- (void)preferences:(id)sender {
  if (!_preferences) _preferences = [[KBPreferences alloc] init];
  [_preferences open];
}

- (void)quit:(id)sender {
  [NSApplication.sharedApplication terminate:sender];
}

+ (NSString *)bundleFile:(NSString *)file {
  NSString *path = [[NSBundle mainBundle] pathForResource:[file stringByDeletingPathExtension] ofType:[file pathExtension]];
  NSString *contents = [NSString stringWithContentsOfFile:path encoding:NSUTF8StringEncoding error:NULL];
  NSAssert(contents, @"No contents at file: %@", file);
  return contents;
}

+ (NSString *)applicationSupport:(NSArray *)subdirs create:(BOOL)create error:(NSError **)error {
  NSString *directory = [NSSearchPathForDirectoriesInDomains(NSApplicationSupportDirectory, NSUserDomainMask, YES) firstObject];
  if (!directory) {
    if (error) *error = KBMakeError(-1, @"No application support directory");
    return nil;
  }
  directory = [directory stringByAppendingPathComponent:@"Keybase"];
  if (subdirs) {
    for (NSString *subdir in subdirs) {
      directory = [directory stringByAppendingPathComponent:subdir];
    }
  }

  if (create && ![NSFileManager.defaultManager fileExistsAtPath:directory]) {
    [NSFileManager.defaultManager createDirectoryAtPath:directory withIntermediateDirectories:YES attributes:nil error:error];
    if (error) {
      return nil;
    }
  }
  return directory;
}

- (void)closeAllWindows {
  [_appView.window close];
  [_preferences close];
}

#pragma mark Error

- (void)setFatalError:(NSError *)error {
  KBFatalErrorView *fatalErrorView = [[KBFatalErrorView alloc] init];
  [fatalErrorView setError:error];
  [fatalErrorView openInWindow:_appView];
}

+ (void)setError:(NSError *)error sender:(NSView *)sender {
  [AppDelegate.sharedDelegate setError:error sender:sender];
}

- (void)setError:(NSError *)error sender:(NSView *)sender {
  NSParameterAssert(error);

  GHErr(@"Error: %@", error);

  if (_alerting) {
    GHDebug(@"Already showing error (%@)", error);
    return;
  }

  NSWindow *window = sender.window;
  if (!window) window = [NSApp mainWindow];
  _alerting = YES;
  GHWeakSelf gself = self;
  if (window) {
    [[NSAlert alertWithError:error] beginSheetModalForWindow:window completionHandler:^(NSModalResponse returnCode) {
      gself.alerting = NO;
    }];
  } else {
    [[NSAlert alertWithError:error] runModal];
  }
  [sender becomeFirstResponder];
}

@end
