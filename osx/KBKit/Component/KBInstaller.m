//
//  KBInstallerView.m
//  Keybase
//
//  Created by Gabriel on 2/23/15.
//  Copyright (c) 2015 Gabriel Handford. All rights reserved.
//

#import "KBInstaller.h"

//#include <launch.h>
#import "KBRunOver.h"
#import "KBInstallable.h"
#import "KBInstallAction.h"
#import "KBWorkspace.h"

#import "KBDefines.h"
#import <ObjectiveSugar/ObjectiveSugar.h>

@implementation KBInstaller

- (void)installWithEnvironment:(KBEnvironment *)environment completion:(void (^)(NSArray *installActions))completion {
  NSArray *installActionsNeeded = [environment installActionsNeeded];
  [self install:installActionsNeeded completion:^{
    completion(installActionsNeeded);
  }];
}

- (void)install:(NSArray *)installActions completion:(dispatch_block_t)completion {
  // Ensure application support dir is available
  [KBWorkspace applicationSupport:nil create:YES error:nil]; // TODO Handle error

  KBRunOver *rover = [[KBRunOver alloc] init];
  rover.enumerator = [installActions objectEnumerator];
  rover.runBlock = ^(KBInstallAction *installAction, KBRunCompletion runCompletion) {
    DDLogDebug(@"Install: %@", installAction.name);
    [installAction.installable install:^(NSError *error) {
      installAction.attempted = YES;
      installAction.error = error; // Error can be nil
      if (!error) {
        [installAction.installable refreshComponent:^(NSError *error) {
          installAction.error = error; // Error can be nil
          runCompletion(installAction);
        }];
      } else {
        runCompletion(installAction);
      }
    }];
  };
  rover.completion = ^(NSArray *installActions) {
    completion();
  };
  [rover run];
}

- (void)installStatusWithEnvironment:(KBEnvironment *)environment completion:(void (^)(BOOL needsInstall))completion {
  [self installStatus:environment.installActions completion:completion];
}

- (void)installStatus:(NSArray *)installActions completion:(void (^)(BOOL needsInstall))completion {
  KBRunOver *rover = [[KBRunOver alloc] init];
  rover.enumerator = [installActions objectEnumerator];
  rover.runBlock = ^(KBInstallAction *installAction, KBRunCompletion runCompletion) {
    DDLogDebug(@"Checking %@", installAction.installable.name);
    [installAction.installable refreshComponent:^(NSError *error) {
      // Clear install outcome (since we're refreshing) and set error if one
      installAction.attempted = NO;
      installAction.error = error; // Error can be nil
      runCompletion(installAction);
    }];
  };
  rover.completion = ^(NSArray *installActions) {
    completion([installActions count] > 0);
  };
  [rover run];
}

- (void)uninstallWithEnvironment:(KBEnvironment *)environment completion:(void (^)(NSArray *installActions))completion {
  NSArray *installActions = [environment.installables map:^(id<KBInstallable> i) {
    return [KBInstallAction installActionWithInstallable:i]; }];
  [self uninstall:installActions completion:^{
    completion(installActions);
  }];
}

- (void)uninstall:(NSArray *)installActions completion:(dispatch_block_t)completion {
  KBRunOver *rover = [[KBRunOver alloc] init];
  rover.enumerator = [installActions reverseObjectEnumerator];
  rover.runBlock = ^(KBInstallAction *installAction, KBRunCompletion runCompletion) {
    [installAction.installable uninstall:^(NSError *error) {
      installAction.attempted = YES;
      installAction.error = error; // Error can be nil
      runCompletion(installAction);
    }];
  };
  rover.completion = ^(NSArray *outputs) {
    completion();
  };
  [rover run];
}

@end
