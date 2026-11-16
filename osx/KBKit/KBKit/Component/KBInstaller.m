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

#import "KBDefines.h"

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

@end
