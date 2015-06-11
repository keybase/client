//
//  AppDelegate.m
//  Keybase
//
//  Created by Gabriel on 12/11/14.
//  Copyright (c) 2014 Gabriel Handford. All rights reserved.
//

#import "AppDelegate.h"

#import <Sparkle/Sparkle.h>
#import <CocoaLumberjack/CocoaLumberjack.h>

@interface AppDelegate ()
@property KBApp *app;
@end

@implementation AppDelegate

- (void)applicationDidFinishLaunching:(NSNotification *)notification {
  _app = [[KBApp alloc] init];
  [_app open];
}

- (void)applicationWillTerminate:(NSNotification *)notification {

}

- (BOOL)applicationShouldTerminateAfterLastWindowClosed:(NSApplication *)application {
  return NO;
}

+ (instancetype)sharedDelegate {
  return (AppDelegate *)[[NSApplication sharedApplication] delegate];
}

- (BOOL)setError:(NSError *)error sender:(NSView *)sender {
  return [_app setError:error sender:sender];
}

- (id)preferencesValueForIdentifier:(NSString *)identifier {
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

  if ([identifier isEqualTo:@"Preferences.LaunchAtLogin"]) {
    return @([self isLoginEnabledForURL:[NSURL fileURLWithPath:NSBundle.mainBundle.executablePath]]);
  }

  return nil;
}

- (BOOL)setPrefencesValue:(id)value forIdentifier:(NSString *)identifier synchronize:(BOOL)synchronize {
  if ([identifier isEqualTo:@"Preferences.Sparkle.AutoUpdate"]) {
    SUUpdater.sharedUpdater.automaticallyChecksForUpdates = [value boolValue];
  } else if ([identifier isEqualTo:@"Preferences.Sparkle.CheckInterval"]) {
    SUUpdater.sharedUpdater.updateCheckInterval = [value doubleValue];
  } else if ([identifier isEqualTo:@"Preferences.Sparkle.AutoDownload"]) {
    SUUpdater.sharedUpdater.automaticallyDownloadsUpdates = [value boolValue];
  } else if ([identifier isEqualTo:@"Preferences.Sparkle.SendsProfile"]) {
    SUUpdater.sharedUpdater.sendsSystemProfile = [value boolValue];
  } else if ([identifier isEqualTo:@"Preferences.LaunchAtLogin"]) {
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
