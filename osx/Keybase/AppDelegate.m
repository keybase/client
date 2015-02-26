//
//  AppDelegate.m
//  Keybase
//
//  Created by Gabriel on 12/11/14.
//  Copyright (c) 2014 Gabriel Handford. All rights reserved.
//

#import "AppDelegate.h"

#import "KBKeyGenView.h"
#import "KBRPC.h"
#import "KBUserProfileView.h"
#import "KBCatalogView.h"
#import "KBPreferences.h"
#import "KBErrorView.h"
#import "KBAppearance.h"
#import "KBInstaller.h"

@interface AppDelegate ()
@property KBAppView *appView;
@property KBPreferences *preferences;

@property KBAPIClient *APIClient;
@property BOOL alerting;
@end

@implementation AppDelegate

- (void)applicationDidFinishLaunching:(NSNotification *)notification {
  [KBAppearance setCurrentAppearance:[[KBAppearanceLight alloc] init]];  

  // Just for mocking, getting at data the RPC client doesn't give us yet
  _APIClient = [[KBAPIClient alloc] initWithAPIHost:KBAPIKeybaseIOHost];

  _appView = [[KBAppView alloc] init];
  [_appView openWindow];
  [_appView connect];
}

- (void)applicationWillTerminate:(NSNotification *)notification {

}

- (BOOL)applicationShouldTerminateAfterLastWindowClosed:(NSApplication *)application {
  return NO;
}

+ (KBRPClient *)client {
  return ((AppDelegate *)[NSApp delegate]).appView.client;
}

+ (KBAPIClient *)APIClient {
  return ((AppDelegate *)[NSApp delegate]).APIClient;
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
    if (error) *error = KBMakeError(-1, @"No application support directory", @"");
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

+ (void)setInProgress:(BOOL)inProgress view:(NSView *)view {
  [self.class _setInProgress:view inProgress:inProgress subviews:view.subviews];
}

+ (void)_setInProgress:(NSView *)view inProgress:(BOOL)inProgress subviews:(NSArray *)subviews {
  for (NSView *view in subviews) {
    if ([view isKindOfClass:NSControl.class]) {
      ((NSControl *)view).enabled = !inProgress;
    } else {
      [self _setInProgress:view inProgress:inProgress subviews:view.subviews];
    }
  }
}

- (void)closeAllWindows {
  [_appView.window close];
  [_preferences close];
}

#pragma mark Error

- (void)setFatalError:(NSError *)error {
  KBErrorView *fatalErrorView = [[KBErrorView alloc] init];
  [fatalErrorView setError:error];
  [fatalErrorView openInWindow];
}

+ (void)setError:(NSError *)error sender:(NSView *)sender {
  [AppDelegate.sharedDelegate setError:error sender:sender];
}

- (void)setError:(NSError *)error sender:(NSView *)sender {
  NSParameterAssert(error);

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
