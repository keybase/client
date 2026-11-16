//
//  KBUninstaller.m
//  Keybase
//
//  Created by Gabriel on 6/11/15.
//  Copyright (c) 2015 Keybase. All rights reserved.
//

#import "KBUninstaller.h"
#import "KBRunOver.h"
#import "KBPath.h"
#import "KBInstallable.h"
#import <CocoaLumberjack/CocoaLumberjack.h>

@implementation KBUninstaller

+ (void)uninstall:(NSArray *)installables completion:(KBCompletion)completion {
  KBRunOver *rover = [[KBRunOver alloc] init];
  rover.enumerator = [installables objectEnumerator];
  rover.runBlock = ^(KBInstallable *installable, KBRunCompletion runCompletion) {
    [installable uninstall:^(NSError *error) {
      installable.error = error;
      runCompletion(installable, NO);
    }];
  };
  rover.completion = ^(NSArray *installables, BOOL stopped) {
    completion([KBInstallable combineErrors:installables ignoreWarnings:YES]);
  };
  [rover run];
}

@end
