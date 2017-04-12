//
//  KBInstallerView.m
//  Keybase
//
//  Created by Gabriel on 2/23/15.
//  Copyright (c) 2015 Gabriel Handford. All rights reserved.
//

#import "KBInstaller.h"

#import "KBRunOver.h"
#import "KBInstallable.h"
#import "KBWorkspace.h"

#import "KBDefines.h"
#import "KBLoginItem.h"
#import "KBSharedFileList.h"

#import <ObjectiveSugar/ObjectiveSugar.h>
#import <GHKit/GHKit.h>

@implementation KBInstaller

- (void)installWithEnvironment:(KBEnvironment *)environment force:(BOOL)force stopOnError:(BOOL)stopOnError completion:(void (^)(NSError *error, NSArray *installables))completion {
  // TODO force

  DDLogDebug(@"Installables: %@", [environment.installables valueForKey:@"name"]);

  KBRunOver *rover = [[KBRunOver alloc] init];
  rover.enumerator = [environment.installables objectEnumerator];
  rover.runBlock = ^(KBInstallable *installable, KBRunCompletion runCompletion) {
    DDLogDebug(@"Install: %@", installable.name);
    [installable install:^(NSError *error) {
      installable.error = error;
      if (stopOnError && error) {
        runCompletion(installable, YES);
        return;
      }
      [installable refreshComponent:^(KBComponentStatus *cs) {
        runCompletion(installable, NO);
      }];
    }];
  };
  rover.completion = ^(NSArray *installables, BOOL stopped) {
    DDLogInfo(@"Install complete");
    for (KBInstallable *installable in installables) {
      NSString *name = installable.name;
      NSString *desc = [[installable installDescription:@"\n"] join:@"\n"];
      DDLogInfo(@"%@: %@", name, desc);
    }
    completion([KBInstallable combineErrors:installables ignoreWarnings:YES], installables);
  };
  [rover run];
}

- (void)refreshStatusWithEnvironment:(KBEnvironment *)environment completion:(dispatch_block_t)completion {
  [self refreshStatus:environment.installables completion:completion];
}

- (void)refreshStatus:(NSArray *)installables completion:(dispatch_block_t)completion {
  KBRunOver *rover = [[KBRunOver alloc] init];
  rover.enumerator = [installables objectEnumerator];
  rover.runBlock = ^(KBInstallable *installable, KBRunCompletion runCompletion) {
    DDLogDebug(@"Checking %@", installable.name);
    [installable refreshComponent:^(KBComponentStatus *cs) {
      runCompletion(installable, NO);
    }];
  };
  rover.completion = ^(NSArray *installables, BOOL stopped) {
    completion();
  };
  [rover run];
}

- (void)uninstallWithEnvironment:(KBEnvironment *)environment completion:(dispatch_block_t)completion {
  [self uninstall:environment.installables completion:^{
    completion();
  }];
}

- (void)uninstall:(NSArray *)installables completion:(dispatch_block_t)completion {
  KBRunOver *rover = [[KBRunOver alloc] init];
  rover.enumerator = [installables reverseObjectEnumerator];
  rover.runBlock = ^(KBInstallable *installable, KBRunCompletion runCompletion) {
    [installable uninstall:^(NSError *error) {
      // TODO Set error
      runCompletion(installable, NO);
    }];
  };
  rover.completion = ^(NSArray *installables, BOOL stopped) {
    completion();
  };
  [rover run];
}

+ (void)setLoginItemEnabled:(BOOL)loginItemEnabled config:(KBEnvConfig *)config appPath:(NSString *)appPath {
  NSBundle *appBundle = [NSBundle bundleWithPath:appPath];
  if (!appBundle) {
    DDLogError(@"No app bundle found (for login item check)");
    return;
  }
  if (loginItemEnabled && ![config isInApplications:appBundle.bundlePath] && ![config isInUserApplications:appBundle.bundlePath]) {
    DDLogError(@"Bundle path is invalid for adding login item: %@", appBundle.bundlePath);
    return;
  }

  DDLogDebug(@"Login item %@ (%@)", (loginItemEnabled ? @"enabled" : @"disabled"), appPath);
  NSError *error = nil;
  BOOL changed = [KBLoginItem setEnabled:loginItemEnabled URL:appBundle.bundleURL error:&error];
  if (error) DDLogError(@"Error setting login item: %@", error);
  DDLogDebug(@"Login items changed: %@", changed ? @"Yes" : @"No");
}

@end
