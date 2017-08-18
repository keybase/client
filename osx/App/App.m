//
//  App.m
//  Keybase
//
//  Created by Gabriel on 11/23/15.
//  Copyright © 2017 Keybase. All rights reserved.
//

#import "App.h"

@interface App ()
@property NSStatusItem *statusItem;
@property KBApp *app;
@end

@implementation App

- (void)applicationDidFinishLaunching:(NSNotification *)notification {
  NSUserDefaults *userDefaults = [KBWorkspace userDefaults];
  [userDefaults registerDefaults:
   @{
     @"Preferences.Log.Level": @(DDLogLevelError),
     }];
  [KBWorkspace setupLogging];

  _statusItem = [[NSStatusBar systemStatusBar] statusItemWithLength:NSVariableStatusItemLength];
  //_statusItem.title = @"Keybase";

#if DEBUG
  NSString *statusBarName = @"StatusIconDev";
#else
  NSString *statusBarName = @"StatusIcon";
#endif

  _statusItem.image = [NSImage imageNamed:statusBarName];
  //_statusItem.alternateImage = [NSImage imageNamed:@""]; // Highlighted
  _statusItem.highlightMode = YES; // Blue background when selected

  _app = [[KBApp alloc] init];

  [self updateMenu];

  [NSNotificationCenter.defaultCenter addObserver:self selector:@selector(statusChanged:) name:KBStatusDidChangeNotification object:nil];

  [_app open];
}

+ (instancetype)sharedDelegate {
  return (App *)[NSApp delegate];
}

- (BOOL)setError:(NSError *)error sender:(NSView *)sender completion:(void (^)(NSModalResponse))completion {
  return [_app setError:error sender:sender completion:completion];
}

- (void)updateMenu {
  _statusItem.menu = [self loadMenu];
}

- (void)statusChanged:(NSNotification *)notification {
  [self updateMenu];
}

- (NSMenu *)loadMenu {
  NSMenu *menu = [[NSMenu alloc] init];

  /*
   [menu addItemWithTitle:@"Preferences" action:@selector(preferences:) keyEquivalent:@""];

   KBRGetCurrentStatusRes *userStatus = self.app.appView.userStatus;
   if (userStatus) {
   if (userStatus.loggedIn && userStatus.user) {
   [menu addItemWithTitle:NSStringWithFormat(@"Log Out (%@)", userStatus.user.username) action:@selector(logout:) keyEquivalent:@""];
   [menu addItem:[NSMenuItem separatorItem]];
   } else {
   [menu addItemWithTitle:@"Log In" action:@selector(login:) keyEquivalent:@""];
   [menu addItem:[NSMenuItem separatorItem]];
   }
   }
   */

  NSString *runMode = NSBundle.mainBundle.infoDictionary[@"KBRunMode"];
  NSAssert(runMode, @"No run mode");
  [menu addItemWithTitle:NSStringWithFormat(@"Status (%@)", runMode) action:@selector(showInstallStatus:) keyEquivalent:@""];
  [menu addItem:[NSMenuItem separatorItem]];
  [menu addItemWithTitle:@"Quit" action:@selector(quit:) keyEquivalent:@""];
  return menu;
}

- (IBAction)preferences:(id)sender {
  [self.app.preferences openWithUserDefaults:[KBWorkspace userDefaults] sender:self.app.appView];
}

- (IBAction)showInstallStatus:(id)sender {
  [self.app.appView showInstallStatusView:^(NSError *error) {}];
  [self.app.appView openWindow];
}

- (IBAction)login:(id)sender {
  [self.app.appView showLogin];
}

- (IBAction)logout:(id)sender {
  [self.app.appView logout:YES];
}

- (IBAction)quit:(id)sender {
  [self.app quitWithPrompt:NO sender:sender];
}

#pragma mark Preferences

- (id)preferencesValueForIdentifier:(NSString *)identifier {
  /*
   if ([identifier isEqualTo:@"Preferences.Sparkle.AutoUpdate"]) {
   return @(SUUpdater.sharedUpdater.automaticallyChecksForUpdates);
   }

   if ([identifier isEqualTo:@"Preferences.Sparkle.CheckInterval"]) {
   return @(SUUpdater.sharedUpdater.updateCheckInterval);
   }

   if ([identifier isEqualTo:@"Preferences.Sparkle.AutoDownload"]) {
   return @(SUUpdater.sharedUpdater.automaticallyDownloadsUpdates);
   }

   if ([identifier isEqualTo:@"Preferences.Sparkle.SendsProfile"]) {
   return @(SUUpdater.sharedUpdater.sendsSystemProfile);
   }
   */

  if ([identifier isEqualTo:@"Preferences.LaunchAtLogin"]) {
    return @([KBLoginItem isLoginEnabledForURL:[NSURL fileURLWithPath:NSBundle.mainBundle.executablePath]]);
  }

  return nil;
}

- (BOOL)setPrefencesValue:(id)value forIdentifier:(NSString *)identifier synchronize:(BOOL)synchronize {
  /*
   if ([identifier isEqualTo:@"Preferences.Sparkle.AutoUpdate"]) {
   SUUpdater.sharedUpdater.automaticallyChecksForUpdates = [value boolValue];
   } else if ([identifier isEqualTo:@"Preferences.Sparkle.CheckInterval"]) {
   SUUpdater.sharedUpdater.updateCheckInterval = [value doubleValue];
   } else if ([identifier isEqualTo:@"Preferences.Sparkle.AutoDownload"]) {
   SUUpdater.sharedUpdater.automaticallyDownloadsUpdates = [value boolValue];
   } else if ([identifier isEqualTo:@"Preferences.Sparkle.SendsProfile"]) {
   SUUpdater.sharedUpdater.sendsSystemProfile = [value boolValue];
   */
  if ([identifier isEqualTo:@"Preferences.LaunchAtLogin"]) {
    NSError *error = nil;
    [KBLoginItem setLoginEnabled:[value boolValue] URL:NSBundle.mainBundle.bundleURL error:&error];
    if (error) DDLogError(@"Error configuring login item: %@", error);
  } else {
    // Not found
    return NO;
  }

  if (synchronize) {
    // TODO
  }

  return YES;
}

@end
