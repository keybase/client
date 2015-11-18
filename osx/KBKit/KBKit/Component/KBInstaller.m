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

#import <ObjectiveSugar/ObjectiveSugar.h>
#import <GHKit/GHKit.h>

@implementation KBInstaller

- (void)installWithEnvironment:(KBEnvironment *)environment force:(BOOL)force completion:(dispatch_block_t)completion {
  // Ensure application support dir is available
  [KBWorkspace applicationSupport:nil create:YES error:nil]; // TODO Handle error

  // TODO force

  KBRunOver *rover = [[KBRunOver alloc] init];
  rover.enumerator = [environment.installables objectEnumerator];
  rover.runBlock = ^(KBInstallable *installable, KBRunCompletion runCompletion) {
    DDLogDebug(@"Install: %@", installable.name);
    [installable install:^(NSError *error) {
      installable.error = error;
      [installable refreshComponent:^(NSError *refreshError) {
        // TODO Remove error from definition
        NSAssert(!refreshError, @"Error shouldn't be set here, use componentStatus");
        runCompletion(installable);
      }];
    }];
  };
  rover.completion = ^(NSArray *installables) {
    completion();
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
    [installable refreshComponent:^(NSError *refreshError) {
      // TODO Remove error from definition
      NSAssert(!refreshError, @"Error shouldn't be set here, use componentStatus");
      runCompletion(installable);
    }];
  };
  rover.completion = ^(NSArray *installables) {
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
      runCompletion(installable);
    }];
  };
  rover.completion = ^(NSArray *installables) {
    completion();
  };
  [rover run];
}

@end
