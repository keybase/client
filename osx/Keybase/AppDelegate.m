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
#import "KBEnvSelectView.h"
#import "KBLogFormatter.h"
#import "KBHelperClient.h"

#import <Sparkle/Sparkle.h>

@interface AppDelegate ()
@property KBAppView *appView;
@property KBPreferences *preferences;
@property BOOL alerting;

@property KBHelperClient *helper;

@property NSStatusItem *statusItem; // Menubar

// Debug
@property KBConsoleView *consoleView;

@property (copy) KBErrorHandler errorHandler;
@end

@implementation AppDelegate

- (void)applicationDidFinishLaunching:(NSNotification *)notification {
  DDTTYLogger.sharedInstance.logFormatter = [[KBLogFormatter alloc] init];
  [DDLog addLogger:DDTTYLogger.sharedInstance withLevel:DDLogLevelDebug]; // Xcode output

  [NSUserDefaults.standardUserDefaults registerDefaults:
   @{
     @"Preferences.Log.Level": @(DDLogLevelError),
    }];

  _preferences = [[KBPreferences alloc] init];
  [self configureConsoleLog];

  [KBAppearance setCurrentAppearance:KBAppearance.lightAppearance];

  [KBButton setErrorHandler:^(KBButton *button, NSError *error) {
    [AppDelegate setError:error sender:button];
  }];

  self.errorHandler = ^(NSError *error, id sender) {
    [AppDelegate setError:error sender:sender];
  };

  GHWeakSelf gself = self;

  // Network reachability is a diagnostic tool that can be used to understand why a request might have failed.
  // It should not be used to determine whether or not to make a request.
  [AFNetworkReachabilityManager.sharedManager setReachabilityStatusChangeBlock:^(AFNetworkReachabilityStatus status) {
    DDLogDebug(@"Reachability: %@", AFStringFromNetworkReachabilityStatus(status));
    [gself.consoleView log:NSStringWithFormat(@"Reachability: %@", AFStringFromNetworkReachabilityStatus(status))];
  }];
  [AFNetworkReachabilityManager.sharedManager startMonitoring];

  KBEnvSelectView *envSelectView = [[KBEnvSelectView alloc] init];
  KBNavigationView *navigation = [[KBNavigationView alloc] initWithView:envSelectView title:@"Keybase"];
  KBWindow *window = [KBWindow windowWithContentView:navigation size:CGSizeMake(500, 380) retain:YES];
  envSelectView.onSelect = ^(KBRPClientEnv env) {
#ifdef DEBUG
    if (env != KBRPClientEnvManual) {
      KBDebugAlertModal(@"Running in debug mode, you should select Manual.");
      return;
    }
#endif
    [window close];
    [self openWithEnv:env];
  };
  window.styleMask = NSFullSizeContentViewWindowMask | NSTitledWindowMask;
  [window center];
  [window makeKeyAndOrderFront:nil];
}

- (void)configureConsoleLog {
  [DDLog removeLogger:DDASLLogger.sharedInstance];
  [DDLog addLogger:DDASLLogger.sharedInstance withLevel:[[_preferences valueForIdentifier:@"Preferences.Log.Level"] unsignedIntegerValue]]; // Console log
}

- (void)openWithEnv:(KBRPClientEnv)env {
  [self updateMenu];

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
  [window kb_addChildWindowForView:_consoleView rect:CGRectMake(0, 40, 400, 400) position:KBWindowPositionRight title:@"Console" fixed:NO makeKey:NO errorHandler:_errorHandler];
  [_appView.delegates addObject:_consoleView];

  _helper = [[KBHelperClient alloc] init];

  KBRPClient *client = [[KBRPClient alloc] initWithEnv:env];
  [_appView connect:client];
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
  [_preferences open:_appView.config.configPath sender:_appView];
}

- (IBAction)login:(id)sender {
  [self.appView showLogin];
}

- (IBAction)logout:(id)sender {
  [self.appView logout:YES];
}

- (IBAction)quit:(id)sender {
  [self quitWithPrompt:YES sender:sender];
}

- (void)quitWithPrompt:(BOOL)prompt sender:(id)sender {
  if (prompt) {
    [KBAlert yesNoWithTitle:@"Quit" description:@"Are you sure you want to quit?" yes:@"Quit" view:_appView completion:^(BOOL yes) {
      if (yes) [NSApplication.sharedApplication terminate:sender];
    }];
  } else {
    [NSApplication.sharedApplication terminate:sender];
  }
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

+ (void)consoleLog:(NSString *)message {
  [AppDelegate.sharedDelegate.consoleView log:message];
}

- (void)openURLString:(NSString *)URLString sender:(NSView *)sender {
  [KBAlert yesNoWithTitle:@"Open a Link" description:NSStringWithFormat(@"Do you want to open %@?", URLString) yes:@"Open" view:sender completion:^(BOOL yes) {
    if (yes) [NSWorkspace.sharedWorkspace openURL:[NSURL URLWithString:URLString]];
  }];
}

- (IBAction)encrypt:(id)sender {
  KBPGPEncryptView *view = [[KBPGPEncryptView alloc] init];
  view.client = self.appView.client;
  [self.appView.window kb_addChildWindowForView:view rect:CGRectMake(0, 0, 510, 400) position:KBWindowPositionCenter title:@"Encrypt" fixed:NO makeKey:YES errorHandler:_errorHandler];
}

- (IBAction)encryptFile:(id)sender {
  KBPGPEncryptFileView *view = [[KBPGPEncryptFileView alloc] init];
  view.client = self.appView.client;
  [self.appView.window kb_addChildWindowForView:view rect:CGRectMake(0, 0, 510, 400) position:KBWindowPositionCenter title:@"Encrypt Files" fixed:NO makeKey:YES errorHandler:_errorHandler];
}

- (IBAction)decrypt:(id)sender {
  KBPGPDecryptView *view = [[KBPGPDecryptView alloc] init];
  view.client = self.appView.client;
  [self.appView.window kb_addChildWindowForView:view rect:CGRectMake(0, 0, 510, 400) position:KBWindowPositionCenter title:@"Decrypt" fixed:NO makeKey:YES errorHandler:_errorHandler];
}

- (IBAction)decryptFile:(id)sender {
  KBPGPDecryptFileView *view = [[KBPGPDecryptFileView alloc] init];
  view.client = self.appView.client;
  [self.appView.window kb_addChildWindowForView:view rect:CGRectMake(0, 0, 510, 400) position:KBWindowPositionCenter title:@"Decrypt Files" fixed:NO makeKey:YES errorHandler:_errorHandler];
}

- (IBAction)sign:(id)sender {
  KBPGPSignView *view = [[KBPGPSignView alloc] init];
  view.client = self.appView.client;
  [self.appView.window kb_addChildWindowForView:view rect:CGRectMake(0, 0, 510, 400) position:KBWindowPositionCenter title:@"Sign" fixed:NO makeKey:YES errorHandler:_errorHandler];
}

- (IBAction)signFile:(id)sender {
  KBPGPSignFileView *view = [[KBPGPSignFileView alloc] init];
  view.client = self.appView.client;
  [self.appView.window kb_addChildWindowForView:view rect:CGRectMake(0, 0, 400, 400) position:KBWindowPositionCenter title:@"Sign File" fixed:NO makeKey:YES errorHandler:_errorHandler];
}

- (IBAction)verify:(id)sender {
  KBPGPVerifyView *view = [[KBPGPVerifyView alloc] init];
  view.client = self.appView.client;
  [self.appView.window kb_addChildWindowForView:view rect:CGRectMake(0, 0, 400, 400) position:KBWindowPositionCenter title:@"Verify" fixed:NO makeKey:YES errorHandler:_errorHandler];
}

- (IBAction)verifyFile:(id)sender {
  KBPGPVerifyFileView *view = [[KBPGPVerifyFileView alloc] init];
  view.client = self.appView.client;
  [self.appView.window kb_addChildWindowForView:view rect:CGRectMake(0, 0, 400, 400) position:KBWindowPositionCenter title:@"Verify File" fixed:NO makeKey:YES errorHandler:_errorHandler];
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

#pragma mark Error Handling

+ (void)setError:(NSError *)error sender:(NSView *)sender {
  [AppDelegate.sharedDelegate setError:error sender:sender completion:nil];
}

+ (void)setError:(NSError *)error sender:(NSView *)sender completion:(void (^)(NSModalResponse returnCode))completion {
  [AppDelegate.sharedDelegate setError:error sender:sender completion:completion];
}

- (void)setError:(NSError *)error sender:(NSView *)sender completion:(void (^)(NSModalResponse returnCode))completion {
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

  DDLogError(@"%@", error);

  if (_alerting) {
    DDLogDebug(@"Already showing error (%@)", error);
    return;
  }

  NSWindow *window = sender.window;
  if (!window) window = [NSApp mainWindow];
  _alerting = YES;
  GHWeakSelf gself = self;

  NSAssert(window, @"No window to show alert");

  [[NSAlert alertWithError:error] beginSheetModalForWindow:window completionHandler:^(NSModalResponse returnCode) {
    gself.alerting = NO;
    if (completion) completion(returnCode);
  }];
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
