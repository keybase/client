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
#import "KBPGPSignView.h"
#import "KBPGPSignFileView.h"
#import "KBPGPVerifyView.h"
#import "KBPGPVerifyFileView.h"

#import <Sparkle/Sparkle.h>

@interface AppDelegate ()
@property KBAppView *appView;
@property KBPreferences *preferences;
@property BOOL alerting;

@property NSStatusItem *statusItem; // Menubar

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

  _statusItem = [[NSStatusBar systemStatusBar] statusItemWithLength:NSVariableStatusItemLength];
  //_statusItem.title = @"Keybase";
#ifdef DEBUG
  _statusItem.image = [NSImage imageNamed:@"StatusIconDev"];
#else
  _statusItem.image = [NSImage imageNamed:@"StatusIconBW"];
#endif
  //_statusItem.alternateImage = [NSImage imageNamed:@""]; // Highlighted
  _statusItem.highlightMode = YES; // Blue background when selected

  _appView = [[KBAppView alloc] init];
  [_appView.delegates addObject:self];
  KBWindow *window = [_appView openWindow];

  _consoleView = [[KBConsoleView alloc] init];
  [window kb_addChildWindowForView:_consoleView rect:CGRectMake(0, 40, 400, 400) position:KBWindowPositionRight title:@"Console" fixed:NO errorHandler:_errorHandler];
  [_appView.delegates addObject:_consoleView];

  _mockViews = [[KBMockViews alloc] init];
  [window kb_addChildWindowForView:_mockViews rect:CGRectMake(0, -510, 400, 500) position:KBWindowPositionRight title:@"Mocks" fixed:NO errorHandler:_errorHandler];

  KBRPClient *client = [[KBRPClient alloc] init];
  [_appView connect:client];

  SUUpdater.sharedUpdater.feedURL = [NSURL URLWithString:@"https://keybase-app.s3.amazonaws.com/appcast.xml"];
  SUUpdater.sharedUpdater.automaticallyChecksForUpdates = YES;
  SUUpdater.sharedUpdater.updateCheckInterval = 60 * 60 * 24;
  [SUUpdater.sharedUpdater checkForUpdatesInBackground];

  [self updateMenu];
}

- (void)applicationWillTerminate:(NSNotification *)notification {

}

- (BOOL)applicationShouldTerminateAfterLastWindowClosed:(NSApplication *)application {
  return NO;
}

- (void)updateMenu {
  NSMenu *menu = [[NSMenu alloc] init];

  [menu addItemWithTitle:@"Preferences" action:@selector(preferences:) keyEquivalent:@""];

  KBRGetCurrentStatusRes *status = _appView.status;
  if (status) {
    if (status.loggedIn && status.user) {
      [menu addItemWithTitle:NSStringWithFormat(@"Log Out (%@)", status.user.username) action:@selector(logout:) keyEquivalent:@""];
      [menu addItem:[NSMenuItem separatorItem]];
    } else {
      [menu addItemWithTitle:@"Log In" action:@selector(login:) keyEquivalent:@""];
      [menu addItem:[NSMenuItem separatorItem]];
    }
  }

  [menu addItem:[NSMenuItem separatorItem]];
  [menu addItemWithTitle:@"Quit" action:@selector(quit:) keyEquivalent:@""];

  _statusItem.menu = menu;
}

+ (KBAppView *)appView {
  return ((AppDelegate *)[NSApp delegate]).appView;
}

+ (AppDelegate *)sharedDelegate {
  return (AppDelegate *)[[NSApplication sharedApplication] delegate];
}

- (IBAction)preferences:(id)sender {
  if (!_preferences) _preferences = [[KBPreferences alloc] init];
  [_preferences open:_appView.config.configPath sender:_appView];
}

- (IBAction)login:(id)sender {
  [self.appView showLogin];
}

- (IBAction)logout:(id)sender {
  [self.appView logout:YES];
}

- (IBAction)quit:(id)sender {
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
  [self.appView.window kb_addChildWindowForView:view rect:CGRectMake(0, 0, 510, 400) position:KBWindowPositionCenter title:@"Encrypt" fixed:NO errorHandler:_errorHandler];
}

- (IBAction)encryptFile:(id)sender {
  KBPGPEncryptFileView *view = [[KBPGPEncryptFileView alloc] init];
  view.client = self.appView.client;
  [self.appView.window kb_addChildWindowForView:view rect:CGRectMake(0, 0, 510, 400) position:KBWindowPositionCenter title:@"Encrypt Files" fixed:NO errorHandler:_errorHandler];
}

- (IBAction)decrypt:(id)sender {
  KBPGPDecryptView *view = [[KBPGPDecryptView alloc] init];
  view.client = self.appView.client;
  [self.appView.window kb_addChildWindowForView:view rect:CGRectMake(0, 0, 510, 400) position:KBWindowPositionCenter title:@"Decrypt" fixed:NO errorHandler:_errorHandler];
}

- (IBAction)decryptFile:(id)sender {
  KBPGPDecryptFileView *view = [[KBPGPDecryptFileView alloc] init];
  view.client = self.appView.client;
  [self.appView.window kb_addChildWindowForView:view rect:CGRectMake(0, 0, 510, 400) position:KBWindowPositionCenter title:@"Decrypt Files" fixed:NO errorHandler:_errorHandler];
}

- (IBAction)sign:(id)sender {
  KBPGPSignView *view = [[KBPGPSignView alloc] init];
  view.client = self.appView.client;
  [self.appView.window kb_addChildWindowForView:view rect:CGRectMake(0, 0, 510, 400) position:KBWindowPositionCenter title:@"Sign" fixed:NO errorHandler:_errorHandler];
}

- (IBAction)signFile:(id)sender {
  KBPGPSignFileView *view = [[KBPGPSignFileView alloc] init];
  view.client = self.appView.client;
  [self.appView.window kb_addChildWindowForView:view rect:CGRectMake(0, 0, 400, 400) position:KBWindowPositionCenter title:@"Sign File" fixed:NO errorHandler:_errorHandler];
}

- (IBAction)verify:(id)sender {
  KBPGPVerifyView *view = [[KBPGPVerifyView alloc] init];
  view.client = self.appView.client;
  [self.appView.window kb_addChildWindowForView:view rect:CGRectMake(0, 0, 400, 400) position:KBWindowPositionCenter title:@"Verify" fixed:NO errorHandler:_errorHandler];
}

- (IBAction)verifyFile:(id)sender {
  KBPGPVerifyFileView *view = [[KBPGPVerifyFileView alloc] init];
  view.client = self.appView.client;
  [self.appView.window kb_addChildWindowForView:view rect:CGRectMake(0, 0, 400, 400) position:KBWindowPositionCenter title:@"Verify File" fixed:NO errorHandler:_errorHandler];
}

+ (dispatch_block_t)openSheetWithView:(NSView *)view size:(CGSize)size sender:(NSView *)sender closeButton:(KBButton *)closeButton {
  NSWindow *window = [KBWindow windowWithContentView:view size:size retain:NO];
  dispatch_block_t close = ^{
    [[sender window] endSheet:window];
  };
  closeButton.targetBlock = close;
  [[sender window] beginSheet:window completionHandler:^(NSModalResponse returnCode) {}];
  return close;
}

#pragma mark Error

+ (void)setError:(NSError *)error sender:(NSView *)sender {
  [AppDelegate.sharedDelegate setError:error sender:sender];
}

- (void)setError:(NSError *)error sender:(NSView *)sender {
  NSParameterAssert(error);

  NSString *errorName = error.userInfo[@"MPErrorInfoKey"][@"name"];
  if ([errorName isEqualToString:@"CANCELED"]) {
    // Canceled, ok to ignore
    return;
  }

  if ([errorName isEqualToString:@"LOGIN_REQUIRED"]) {
    [self.appView logout:NO];
    return;
  }

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

#pragma mark KBAppViewDelegate

- (void)appViewDidLaunch:(KBAppView *)appView { }
- (void)appView:(KBAppView *)appView didCheckInstall:(BOOL)installed installType:(KBInstallType)installType { }
- (void)appView:(KBAppView *)appView didErrorOnInstall:(NSError *)error { }
- (void)appView:(KBAppView *)appView willConnectWithClient:(KBRPClient *)client{ }
- (void)appView:(KBAppView *)appView didConnectWithClient:(KBRPClient *)client { }
- (void)appView:(KBAppView *)appView didCheckStatusWithConfig:(KBRConfig *)config status:(KBRGetCurrentStatusRes *)status { }
- (void)appView:(KBAppView *)appView didDisconnectWithClient:(KBRPClient *)client { }
- (void)appView:(KBAppView *)appView didErrorOnConnect:(NSError *)error connectAttempt:(NSInteger)connectAttempt { }
- (void)appView:(KBAppView *)appView didLogMessage:(NSString *)message { }

- (void)appViewDidUpdateStatus:(KBAppView *)appView {
  [self updateMenu];
}

@end
