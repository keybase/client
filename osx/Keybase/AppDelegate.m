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
#import "KBPGPEncryptView.h"
#import "KBPGPEncryptFileView.h"
#import "KBPGPDecryptView.h"
#import "KBPGPDecryptFileView.h"

#import <Sparkle/Sparkle.h>

@interface AppDelegate ()
@property KBAppView *appView;
@property KBPreferences *preferences;
@property BOOL alerting;

// Debug
@property KBConsoleView *consoleView;
@property KBMockViews *mockViews;

@property (copy) KBErrorHandler errorHandler;
@end

@implementation AppDelegate

- (void)applicationDidFinishLaunching:(NSNotification *)notification {
  [KBAppearance setCurrentAppearance:KBAppearance.lightAppearance];

  [KBButton setErrorHandler:^(KBButton *button, NSError *error) {
    [AppDelegate setError:error sender:button];
  }];

  self.errorHandler = ^(NSError *error, id sender) {
    [AppDelegate setError:error sender:sender];
  };

  _appView = [[KBAppView alloc] init];
  KBWindow *window = [_appView openWindow];

  _consoleView = [[KBConsoleView alloc] init];
  [window kb_addChildWindowForView:_consoleView rect:CGRectMake(0, 0, 400, 400) position:KBWindowPositionRight title:@"Console" errorHandler:_errorHandler];
  _appView.delegate = _consoleView;

  _mockViews = [[KBMockViews alloc] init];
  [window kb_addChildWindowForView:_mockViews rect:CGRectMake(0, -510, 400, 500) position:KBWindowPositionRight title:@"Mocks" errorHandler:_errorHandler];

  KBRPClient *client = [[KBRPClient alloc] init];
  [_appView connect:client];

  SUUpdater.sharedUpdater.feedURL = [NSURL URLWithString:@"https://keybase-app.s3.amazonaws.com/appcast.xml"];
  SUUpdater.sharedUpdater.automaticallyChecksForUpdates = YES;
  SUUpdater.sharedUpdater.updateCheckInterval = 60 * 60 * 24;
  [SUUpdater.sharedUpdater checkForUpdatesInBackground];
}

- (void)applicationWillTerminate:(NSNotification *)notification {

}

- (BOOL)applicationShouldTerminateAfterLastWindowClosed:(NSApplication *)application {
  return NO;
}

+ (KBAppView *)appView {
  return ((AppDelegate *)[NSApp delegate]).appView;
}

+ (AppDelegate *)sharedDelegate {
  return (AppDelegate *)[[NSApplication sharedApplication] delegate];
}

- (IBAction)preferences:(id)sender {
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

- (void)openURLString:(NSString *)URLString sender:(NSView *)sender {
  [KBAlert yesNoWithTitle:@"Open a Link" description:NSStringWithFormat(@"Do you want to open %@?", URLString) yes:@"Open" view:sender completion:^(BOOL yes) {
    if (yes) [NSWorkspace.sharedWorkspace openURL:[NSURL URLWithString:URLString]];
  }];
}

- (IBAction)encrypt:(id)sender {
  KBPGPEncryptView *view = [[KBPGPEncryptView alloc] init];
  view.client = self.appView.client;
  [self.appView.window kb_addChildWindowForView:view rect:CGRectMake(0, 0, 510, 400) position:KBWindowPositionCenter title:@"Encrypt" errorHandler:_errorHandler];
}

- (IBAction)encryptFile:(id)sender {
  KBPGPEncryptFileView *view = [[KBPGPEncryptFileView alloc] init];
  view.client = self.appView.client;
  [self.appView.window kb_addChildWindowForView:view rect:CGRectMake(0, 0, 510, 400) position:KBWindowPositionCenter title:@"Encrypt Files" errorHandler:_errorHandler];
}

- (IBAction)decrypt:(id)sender {
  KBPGPDecryptView *view = [[KBPGPDecryptView alloc] init];
  view.client = self.appView.client;
  [self.appView.window kb_addChildWindowForView:view rect:CGRectMake(0, 0, 510, 400) position:KBWindowPositionCenter title:@"Decrypt" errorHandler:_errorHandler];
}

- (IBAction)decryptFile:(id)sender {
  KBPGPDecryptFileView *view = [[KBPGPDecryptFileView alloc] init];
  view.client = self.appView.client;
  [self.appView.window kb_addChildWindowForView:view rect:CGRectMake(0, 0, 510, 400) position:KBWindowPositionCenter title:@"Decrypt Files" errorHandler:_errorHandler];
}

+ (void)openSheetWithView:(NSView *)view size:(CGSize)size sender:(NSView *)sender closeButton:(KBButton *)closeButton {
  NSWindow *window = [KBWindow windowWithContentView:view size:size retain:NO];
  closeButton.targetBlock = ^{
    [[sender window] endSheet:window];
  };
  [[sender window] beginSheet:window completionHandler:^(NSModalResponse returnCode) {}];
}

#pragma mark Error

- (void)setFatalError:(NSError *)error {
  KBFatalErrorView *fatalErrorView = [[KBFatalErrorView alloc] init];
  [fatalErrorView setError:error];
  [self.appView.window kb_addChildWindowForView:fatalErrorView rect:CGRectMake(0, 0, 510, 400) position:KBWindowPositionCenter title:@"Keybase" errorHandler:_errorHandler];
}

+ (void)setError:(NSError *)error sender:(NSView *)sender {
  if ([error.userInfo[@"MPErrorInfoKey"][@"name"] isEqualToString:@"CANCELED"]) {
    // Canceled, ok to ignore
    return;
  }
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
    gself.alerting = NO;
  }
  [sender becomeFirstResponder];
}

@end
