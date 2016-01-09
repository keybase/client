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

- (void)installWithEnvironment:(KBEnvironment *)environment force:(BOOL)force completion:(void (^)(NSError *error, NSArray *installables))completion {
  // TODO force

  KBRunOver *rover = [[KBRunOver alloc] init];
  rover.enumerator = [environment.installables objectEnumerator];
  rover.runBlock = ^(KBInstallable *installable, KBRunCompletion runCompletion) {
    DDLogDebug(@"Install: %@", installable.name);
    [installable install:^(NSError *error) {
      installable.error = error;
      [installable refreshComponent:^(KBComponentStatus *cs) {
        runCompletion(installable);
      }];
    }];
  };
  rover.completion = ^(NSArray *installables) {
    for (KBInstallable *installable in installables) {
      NSString *name = installable.name;
      NSString *desc = [[installable installDescription:@"\n"] join:@"\n"];
      DDLogInfo(@"%@: %@", name, desc);
    }
    completion([self combineErrors:installables], installables);
  };
  [rover run];
}

- (NSError *)combineErrors:(NSArray *)installables {
  BOOL installed = YES;
  NSMutableArray *errorMessages = [NSMutableArray array];
  for (KBInstallable *installable in installables) {
    if (installable.error) {
      NSString *errorMessage = NSStringWithFormat(@"%@ (%@)", installable.error.localizedDescription, @(installable.error.code));
      if (![errorMessages containsObject:errorMessage]) [errorMessages addObject:errorMessage];
    }
    installed &= [installable isInstalled];
  }

  if ([errorMessages count] == 0) {
    if (!installed) {
      // No errors but not everything was installed (this hopefully shouldn't happen)
      return KBMakeError(-1, @"Unknown install error");
    } else {
      // Success (no errors)
      return nil;
    }
  }

  return KBMakeError(-1, @"%@", [errorMessages join:@". "]);

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
