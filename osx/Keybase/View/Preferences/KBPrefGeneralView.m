//
//  KBPrefGeneralView.m
//  Keybase
//
//  Created by Gabriel on 4/3/15.
//  Copyright (c) 2015 Gabriel Handford. All rights reserved.
//

#import "KBPrefGeneralView.h"

#import "KBPrefCheckbox.h"
#import "KBPrefPopUpView.h"
#import "KBPrefOption.h"

#import <Sparkle/Sparkle.h>

@implementation KBPrefGeneralView

- (instancetype)initWithPreferences:(KBPreferences *)preferences {
  if ((self = [super init])) {
    [self setOptions:@{@"spacing": @"10", @"insets": @"40,0,40,0"}];

    KBPrefCheckbox *launchAtLogin = [[KBPrefCheckbox alloc] init];
    [launchAtLogin setCategory:@"System"];
    [launchAtLogin setLabelText:@"Launch Keybase at login" identifier:@"Preferences.LaunchAtLogin" preferences:self];
    [self addSubview:launchAtLogin];

    [self addSubview:[KBBox spacing:10]];

    KBPrefCheckbox *autoUpdate = [[KBPrefCheckbox alloc] init];
    [autoUpdate setCategory:@"Updater"];
    [autoUpdate setLabelText:@"Automatically check for updates" identifier:@"Preferences.Sparkle.AutoUpdate" preferences:self];
    [self addSubview:autoUpdate];

    KBPrefPopUpView *updateCheckInterval = [[KBPrefPopUpView alloc] init];
    updateCheckInterval.inset = 170;
    updateCheckInterval.fieldWidth = 150;
    NSArray *options = @[[KBPrefOption prefOptionWithLabel:@"Hour" value:@(3600)],
                         [KBPrefOption prefOptionWithLabel:@"Day" value:@(86400)],
                         [KBPrefOption prefOptionWithLabel:@"Week" value:@(604800)],
                         [KBPrefOption prefOptionWithLabel:@"Month" value:@(2629800)],
                         ];
    [updateCheckInterval setLabelText:@"Check Every" options:options identifier:@"Preferences.Sparkle.CheckInterval" preferences:self];
    [self addSubview:updateCheckInterval];

    KBPrefCheckbox *autoDownload = [[KBPrefCheckbox alloc] init];
    [autoDownload setLabelText:@"Automatically download updates" identifier:@"Preferences.Sparkle.AutoDownload" preferences:self];
    [self addSubview:autoDownload];

    KBPrefCheckbox *sendsProfile = [[KBPrefCheckbox alloc] init];
    [sendsProfile setLabelText:@"Sends system profile" identifier:@"Preferences.Sparkle.SendsProfile" preferences:self];
    [self addSubview:sendsProfile];
  }
  return self;
}

- (id)valueForIdentifier:(NSString *)identifier {
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

  NSAssert(NO, @"Unknown preference");
  return nil;
}

- (void)setValue:(id)value forIdentifier:(NSString *)identifier synchronize:(BOOL)synchronize {
  if ([identifier isEqualTo:@"Preferences.Sparkle.AutoUpdate"]) {
    SUUpdater.sharedUpdater.automaticallyChecksForUpdates = [value boolValue];
  }

  if ([identifier isEqualTo:@"Preferences.Sparkle.CheckInterval"]) {
    SUUpdater.sharedUpdater.updateCheckInterval = [value doubleValue];
  }

  if ([identifier isEqualTo:@"Preferences.Sparkle.AutoDownload"]) {
    SUUpdater.sharedUpdater.automaticallyDownloadsUpdates = [value boolValue];
  }

  if ([identifier isEqualTo:@"Preferences.Sparkle.SendsProfile"]) {
    SUUpdater.sharedUpdater.sendsSystemProfile = [value boolValue];
  }

  if ([identifier isEqualTo:@"Preferences.LaunchAtLogin"]) {
    [self setLoginEnabled:[value boolValue] forURL:[NSURL fileURLWithPath:NSBundle.mainBundle.executablePath]];
  }
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
        GHErr(@"Error removing item: %@", @(status));
      }
    }
  }];
}

@end
