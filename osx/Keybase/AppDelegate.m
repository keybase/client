//
//  AppDelegate.m
//  Keybase
//
//  Created by Gabriel on 12/11/14.
//  Copyright (c) 2014 Gabriel Handford. All rights reserved.
//

#import "AppDelegate.h"

//#import <Sparkle/Sparkle.h>
#import <CocoaLumberjack/CocoaLumberjack.h>
#import <GHKit/GHKit.h>

#import <KBKit/KBWorkspace.h>
#import <KBKit/KBNotifications.h>

#import <Keybase/Keybase-Swift.h>

@interface AppDelegate ()
@property NSStatusItem *statusItem;
@property NSDictionary *config;
@end

@implementation AppDelegate

- (void)applicationDidFinishLaunching:(NSNotification *)notification {
  NSUserDefaults *userDefaults = [KBWorkspace userDefaults];
  [userDefaults registerDefaults:
   @{
     @"Preferences.Log.Level": @(DDLogLevelError),
     }];
  [KBWorkspace setupLogging];

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

  [NSNotificationCenter.defaultCenter addObserver:self selector:@selector(statusChanged:) name:KBStatusDidChangeNotification object:nil];

  [_app open];
}

- (void)applicationWillTerminate:(NSNotification *)notification {

}

- (BOOL)applicationShouldTerminateAfterLastWindowClosed:(NSApplication *)application {
  return NO;
}

+ (instancetype)sharedDelegate {
  return (AppDelegate *)[NSApp delegate];
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

  [menu addItem:[NSMenuItem separatorItem]];
  [menu addItemWithTitle:@"Quit" action:@selector(quit:) keyEquivalent:@""];
  return menu;
}

- (IBAction)preferences:(id)sender {
  [self.app.preferences openWithUserDefaults:[KBWorkspace userDefaults] sender:self.app.appView];
}

- (IBAction)login:(id)sender {
  [self.app.appView showLogin];
}

- (IBAction)logout:(id)sender {
  [self.app.appView logout:YES];
}

- (IBAction)quit:(id)sender {
  [self.app quitWithPrompt:YES sender:sender];
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
    return @([self isLoginEnabledForURL:[NSURL fileURLWithPath:NSBundle.mainBundle.executablePath]]);
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
    [self setLoginEnabled:[value boolValue] forURL:[NSURL fileURLWithPath:NSBundle.mainBundle.executablePath]];
  } else {
    // Not found
    return NO;
  }

  if (synchronize) {
    // TODO
  }

  return YES;
}

- (void)findLoginItemForURL:(NSURL *)URL completion:(void (^)(LSSharedFileListRef loginItems, LSSharedFileListItemRef item))completion {
  LSSharedFileListRef loginItemsRef = LSSharedFileListCreate(NULL, kLSSharedFileListSessionLoginItems, NULL);
  if (!loginItemsRef) return;

  UInt32 seed = 0U;
  BOOL found = NO;
  CFArrayRef currentLoginItemsRef = LSSharedFileListCopySnapshot(loginItemsRef, &seed);
  NSArray *currentLoginItems = (__bridge NSArray *)currentLoginItemsRef;
  for (id itemObject in currentLoginItems) {
    LSSharedFileListItemRef itemRef = (__bridge LSSharedFileListItemRef)itemObject;

    UInt32 resolutionFlags = kLSSharedFileListNoUserInteraction | kLSSharedFileListDoNotMountVolumes;
    CFErrorRef errorRef;
    CFURLRef URLRef = LSSharedFileListItemCopyResolvedURL(itemRef, resolutionFlags, &errorRef);
    if ([URL isEqualTo:(__bridge NSURL *)URLRef]) {
      completion(loginItemsRef, itemRef);
      found = YES;
      break;
    }
  }

  if (!found) {
    completion(loginItemsRef, NULL);
  }

  CFRelease(currentLoginItemsRef);
  CFRelease(loginItemsRef);
}

- (BOOL)isLoginEnabledForURL:(NSURL *)URL {
  __block BOOL found = NO;
  [self findLoginItemForURL:URL completion:^(LSSharedFileListRef loginItems, LSSharedFileListItemRef item) {
    found = (item != NULL);
  }];
  return found;
}

- (void)setLoginEnabled:(BOOL)loginEnabled forURL:(NSURL *)URL {
  [self findLoginItemForURL:URL completion:^(LSSharedFileListRef loginItems, LSSharedFileListItemRef itemRef) {
    if (loginEnabled && !itemRef) {
      itemRef = LSSharedFileListInsertItemURL(loginItems, kLSSharedFileListItemLast, (CFStringRef)@"Keybase", NULL, (__bridge CFURLRef)URL, NULL, NULL);
      CFRelease(itemRef);
    } else if (!loginEnabled && itemRef) {
      OSStatus status = LSSharedFileListItemRemove(loginItems, itemRef);
      if (status != noErr) {
        DDLogError(@"Error removing login item: %@", @(status));
      }
    }
  }];
}

@end
