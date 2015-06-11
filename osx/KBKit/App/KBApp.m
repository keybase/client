//
//  KBApp.m
//  Keybase
//
//  Created by Gabriel on 6/10/15.
//  Copyright (c) 2015 Keybase. All rights reserved.
//

#import "KBApp.h"

#import "KBAppView.h"
#import "KBPreferences.h"
#import "KBControlPanel.h"
#import "KBConsoleView.h"
#import "KBWorkspace.h"
#import "KBLogFormatter.h"
#import "KBEnvSelectView.h"
#import "KBPGPEncryptView.h"
#import "KBPGPEncryptFilesView.h"
#import "KBPGPDecryptView.h"
#import "KBPGPDecryptFileView.h"
#import "KBPGPSignView.h"
#import "KBPGPSignFileView.h"
#import "KBPGPSignFilesView.h"
#import "KBPGPVerifyView.h"
#import "KBPGPVerifyFileView.h"

#import <AFNetworking/AFNetworking.h>


@interface KBApp () <KBAppViewDelegate>
@property KBAppView *appView;
@property KBPreferences *preferences;
@property BOOL alerting;

@property NSStatusItem *statusItem; // Menubar

// Debug
@property KBControlPanel *controlPanel;
@property KBConsoleView *consoleView;
@end

@implementation KBApp

+ (instancetype)app {
  return [[NSApp delegate] app];
}

- (void)open {
  DDTTYLogger.sharedInstance.logFormatter = [[KBLogFormatter alloc] init];
  [DDLog addLogger:DDTTYLogger.sharedInstance withLevel:DDLogLevelDebug]; // Xcode output

  NSUserDefaults *userDefaults = [KBWorkspace userDefaults];
  [userDefaults registerDefaults:
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

  // TODO Remove this
  [KBButton setErrorHandler:^(KBButton *button, NSError *error) {
    [self setError:error sender:button];
  }];

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
  _statusItem = [[NSStatusBar systemStatusBar] statusItemWithLength:NSVariableStatusItemLength];
  //_statusItem.title = @"Keybase";
#ifdef DEBUG
  _statusItem.image = [NSImage imageNamed:@"StatusIconDev"];
#else
  _statusItem.image = [NSImage imageNamed:@"StatusIconBW"];
#endif
  //_statusItem.alternateImage = [NSImage imageNamed:@""]; // Highlighted
  _statusItem.highlightMode = YES; // Blue background when selected
  [self updateMenu];

  _appView = [[KBAppView alloc] init];
  _appView.delegate = self;
  [_appView openWindow];

  NSMutableArray *componentsForControlPanel = [environment.componentsForControlPanel mutableCopy];
  [componentsForControlPanel addObject:_appView];
  [_controlPanel addComponents:componentsForControlPanel];
  [_controlPanel open:_appView];

  [_appView openWithEnvironment:environment];
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

- (NSString *)currentUsername {
  return [[[self appView] user] username];
}

- (NSString *)APIURLString:(NSString *)path {
  return [[self appView] APIURLString:path];
}

- (IBAction)preferences:(id)sender {
  [_preferences open:_appView.environment.service.userConfig.configPath userDefaults:[KBWorkspace userDefaults] sender:_appView];
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

- (void)closeAllWindows {
  [_appView.window close];
  [_preferences close];
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

#pragma mark Error Handling

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

- (void)appViewDidUpdateStatus:(KBAppView *)appView {
  [self updateMenu];
}


@end
