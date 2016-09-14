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
  // The order of the installables to uninstall is important.
  // For example, if you remove the helper first, kext won't unload.
  if (settings.uninstallOptions & UninstallOptionMountDir) {
    KBMountDir *mountDir = [[KBMountDir alloc] initWithConfig:environment.config helperTool:environment.helperTool];
    [installables addObject:mountDir];
  }
  if (settings.uninstallOptions & UninstallOptionFuse) {
    if (!environment.fuse) {
      completion(KBMakeError(-1, @"No fuse to uninstall"));
      return;
    }
    [installables addObject:environment.fuse];
  }
  if (settings.uninstallOptions & UninstallOptionHelper) {
    [installables addObject:environment.helperTool];
  }
  if (settings.uninstallOptions & UninstallOptionApp) {
    [installables addObject:[[KBAppBundle alloc] initWithPath:settings.appPath]];
  }
  [KBUninstaller uninstall:installables completion:completion];
}

@end

