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
#import "KBEnvSelectView.h"
#import "KBLogFormatter.h"
#import "KBControlPanel.h"

// For PGP menu
#import "KBPGPEncryptView.h"
#import "KBPGPEncryptFilesView.h"
#import "KBPGPDecryptView.h"
#import "KBPGPDecryptFileView.h"
#import "KBPGPSignView.h"
#import "KBPGPSignFileView.h"
#import "KBPGPSignFilesView.h"
#import "KBPGPVerifyView.h"
#import "KBPGPVerifyFileView.h"
#import "KBPGPOutputView.h"

#import <Sparkle/Sparkle.h>
#import <AFNetworking/AFNetworking.h>

@interface AppDelegate ()
@property KBAppView *appView;
@property KBPreferences *preferences;
@property BOOL alerting;

@property NSStatusItem *statusItem; // Menubar

// Debug
@property KBControlPanel *controlPanel;
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

  _consoleView = [[KBConsoleView alloc] init];

  _controlPanel = [[KBControlPanel alloc] init];
  [_controlPanel addComponents:@[_consoleView]];

  DDLogLevel logLevel = [[_preferences valueForIdentifier:@"Preferences.Log.Level"] unsignedIntegerValue];
  [DDLog addLogger:DDASLLogger.sharedInstance withLevel:logLevel];
  [DDLog addLogger:_consoleView withLevel:DDLogLevelVerbose];

  [KBAppearance setCurrentAppearance:KBAppearance.lightAppearance];

  [KBButton setErrorHandler:^(KBButton *button, NSError *error) {
    [AppDelegate setError:error sender:button];
  }];

  self.errorHandler = ^(NSError *error, id sender) {
    [AppDelegate setError:error sender:sender];
  };

  // Network reachability is a diagnostic tool that can be used to understand why a request might have failed.
  // It should not be used to determine whether or not to make a request.
  [AFNetworkReachabilityManager.sharedManager setReachabilityStatusChangeBlock:^(AFNetworkReachabilityStatus status) {
    DDLogInfo(@"Reachability: %@", AFStringFromNetworkReachabilityStatus(status));
  }];
  [AFNetworkReachabilityManager.sharedManager startMonitoring];

  KBEnvSelectView *envSelectView = [[KBEnvSelectView alloc] init];
  KBNavigationView *navigation = [[KBNavigationView alloc] initWithView:envSelectView title:@"Keybase"];
  KBWindow *window = [KBWindow windowWithContentView:navigation size:CGSizeMake(900, 600) retain:YES];
  envSelectView.onSelect = ^(KBEnvironment *environment) {
    [window close];
    [self openWithEnvironment:environment];
  };
  window.styleMask = NSFullSizeContentViewWindowMask | NSTitledWindowMask | NSResizableWindowMask;
  [window center];
  [window makeKeyAndOrderFront:nil];

//#ifdef DEBUG
//  dispatch_after(dispatch_time(DISPATCH_TIME_NOW, (int64_t)(0.2 * NSEC_PER_SEC)), dispatch_get_main_queue(), ^{
//    envSelectView.onSelect([KBEnvironment env:KBEnvManual]);
//  });
//#endif
}

- (void)openWithEnvironment:(KBEnvironment *)environment {
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
  [_appView openWindow];

#ifdef DEBUG
  KBMockViews *mockViews = [[KBMockViews alloc] init];
  [mockViews open:_appView];
#endif

  [_controlPanel open:_appView];

  [_appView openWithEnvironment:environment];
}

- (void)applicationWillTerminate:(NSNotification *)notification {

}

- (BOOL)applicationShouldTerminateAfterLastWindowClosed:(NSApplication *)application {
  return NO;
}

- (void)updateMenu {
  NSMenu *menu = [[NSMenu alloc] init];

  [menu addItemWithTitle:@"Preferences" action:@selector(preferences:) keyEquivalent:@""];

  KBRGetCurrentStatusRes *status = _appView.environment.service.userStatus;
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

+ (KBConsoleView *)consoleView {
  return ((AppDelegate *)[NSApp delegate]).consoleView;
}

+ (AppDelegate *)sharedDelegate {
  return (AppDelegate *)[[NSApplication sharedApplication] delegate];
}

- (IBAction)preferences:(id)sender {
  [_preferences open:_appView.environment.service.userConfig.configPath sender:_appView];
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

- (void)openURLString:(NSString *)URLString sender:(NSView *)sender {
  [KBAlert yesNoWithTitle:@"Open a Link" description:NSStringWithFormat(@"Do you want to open %@?", URLString) yes:@"Open" view:sender completion:^(BOOL yes) {
    if (yes) [NSWorkspace.sharedWorkspace openURL:[NSURL URLWithString:URLString]];
  }];
}

- (IBAction)encrypt:(id)sender {
  KBPGPEncryptView *view = [[KBPGPEncryptView alloc] init];
  view.client = self.appView.environment.service.client;
  [self.appView.window kb_addChildWindowForView:view rect:CGRectMake(0, 0, 510, 400) position:KBWindowPositionCenter title:@"Encrypt" fixed:NO makeKey:YES];
}

- (IBAction)encryptFile:(id)sender {
  KBPGPEncryptFilesView *view = [[KBPGPEncryptFilesView alloc] init];
  view.client = self.appView.environment.service.client;
  [self.appView.window kb_addChildWindowForView:view rect:CGRectMake(0, 0, 510, 400) position:KBWindowPositionCenter title:@"Encrypt Files" fixed:NO makeKey:YES];
}

- (IBAction)decrypt:(id)sender {
  KBPGPDecryptView *view = [[KBPGPDecryptView alloc] init];
  view.client = self.appView.environment.service.client;
  [self.appView.window kb_addChildWindowForView:view rect:CGRectMake(0, 0, 510, 400) position:KBWindowPositionCenter title:@"Decrypt" fixed:NO makeKey:YES];
}

- (IBAction)decryptFile:(id)sender {
  KBPGPDecryptFileView *view = [[KBPGPDecryptFileView alloc] init];
  view.client = self.appView.environment.service.client;
  [self.appView.window kb_addChildWindowForView:view rect:CGRectMake(0, 0, 510, 400) position:KBWindowPositionCenter title:@"Decrypt Files" fixed:NO makeKey:YES];
}

- (IBAction)sign:(id)sender {
  KBPGPSignView *view = [[KBPGPSignView alloc] init];
  view.client = self.appView.environment.service.client;
  [self.appView.window kb_addChildWindowForView:view rect:CGRectMake(0, 0, 510, 400) position:KBWindowPositionCenter title:@"Sign" fixed:NO makeKey:YES];
}

- (IBAction)signFile:(id)sender {
  KBPGPSignFileView *view = [[KBPGPSignFileView alloc] init];
  view.client = self.appView.environment.service.client;
  [self.appView.window kb_addChildWindowForView:view rect:CGRectMake(0, 0, 400, 400) position:KBWindowPositionCenter title:@"Sign File" fixed:NO makeKey:YES];
}

- (IBAction)signFiles:(id)sender {
  KBPGPSignFilesView *view = [[KBPGPSignFilesView alloc] init];
  view.client = self.appView.environment.service.client;
  [self.appView.window kb_addChildWindowForView:view rect:CGRectMake(0, 0, 400, 400) position:KBWindowPositionCenter title:@"Sign Files" fixed:NO makeKey:YES];
}

- (IBAction)verify:(id)sender {
  KBPGPVerifyView *view = [[KBPGPVerifyView alloc] init];
  view.client = self.appView.environment.service.client;
  [self.appView.window kb_addChildWindowForView:view rect:CGRectMake(0, 0, 400, 400) position:KBWindowPositionCenter title:@"Verify" fixed:NO makeKey:YES];
}

- (IBAction)verifyFile:(id)sender {
  KBPGPVerifyFileView *view = [[KBPGPVerifyFileView alloc] init];
  view.client = self.appView.environment.service.client;
  [self.appView.window kb_addChildWindowForView:view rect:CGRectMake(0, 0, 400, 400) position:KBWindowPositionCenter title:@"Verify File" fixed:NO makeKey:YES];
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

+ (BOOL)setError:(NSError *)error sender:(NSView *)sender {
  return [AppDelegate.sharedDelegate setError:error sender:sender completion:nil];
}

+ (BOOL)setError:(NSError *)error sender:(NSView *)sender completion:(void (^)(NSModalResponse returnCode))completion {
  return [AppDelegate.sharedDelegate setError:error sender:sender completion:completion];
}

- (BOOL)setError:(NSError *)error sender:(NSView *)sender {
  return [self setError:error sender:sender completion:nil];
}

- (BOOL)setError:(NSError *)error sender:(NSView *)sender completion:(void (^)(NSModalResponse returnCode))completion {
  if (!error) return NO;

  if (KBIsErrorName(error, @"CANCELED")) {
    // Canceled, ok to ignore
    return NO;
  }

  if (KBIsErrorName(error, @"LOGIN_REQUIRED")) {
    [self.appView showInProgress:@"Loading"];
    [self.appView checkStatus];
    return YES;
  }

  DDLogError(@"%@", error);

  if (_alerting) {
    DDLogDebug(@"Already showing error (%@)", error);
    return YES;
  }

  NSWindow *window = sender.window;
  if (!window) window = [NSApp mainWindow];
  if (!window) window = [NSApp keyWindow];
  if (!window) window = [[NSApp windows] firstObject];

  NSAssert(window, @"No window to show alert");

  _alerting = YES;
  GHWeakSelf gself = self;
  [[NSAlert alertWithError:error] beginSheetModalForWindow:window completionHandler:^(NSModalResponse returnCode) {
    gself.alerting = NO;
    if (completion) completion(returnCode);
  }];
  return YES;
}

#pragma mark KBAppViewDelegate

- (void)appViewDidLaunch:(KBAppView *)appView { }
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
