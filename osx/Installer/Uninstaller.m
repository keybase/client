//
//  Uninstaller.m
//  Keybase
//
//  Created by Gabriel on 1/28/16.
//  Copyright © 2016 Keybase. All rights reserved.
//

#import "Uninstaller.h"

#import <KBKit/KBKit.h>

@implementation Uninstaller

+ (void)uninstallWithSettings:(Settings *)settings completion:(KBCompletion)completion {
  KBEnvironment *environment = settings.environment;
  NSMutableArray *installables = [NSMutableArray array];
  if (settings.uninstallOptions & UninstallOptionApp) {
    [installables addObject:[[KBAppBundle alloc] initWithPath:settings.appPath]];
  }
  if (settings.uninstallOptions & UninstallOptionKext) {
    if (environment.fuse) {
      [installables addObject:environment.fuse];
    } else {
      completion(KBMakeError(-1, @"No fuse to uninstall"));
      return;
    }
  }
  [KBUninstaller uninstall:installables completion:completion];
}

@end

