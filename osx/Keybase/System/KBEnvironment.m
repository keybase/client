//
//  KBEnvironment.m
//  Keybase
//
//  Created by Gabriel on 4/22/15.
//  Copyright (c) 2015 Gabriel Handford. All rights reserved.
//

#import "KBEnvironment.h"

#import "KBService.h"
#import "KBFSService.h"
#import "KBHelperTool.h"
#import "KBFuseComponent.h"
#import "KBCLIInstall.h"
#import "KBRunOver.h"


@interface KBEnvironment ()
@property KBEnvConfig *config;
@property KBService *service;
@property NSMutableArray */*of id<KBComponent>*/components;
@property NSArray */*of id<KBInstallable>*/installables;
@property NSArray */*of KBInstallAction*/installActions;

@property NSArray */*of KBLaunchService*/services;
@end

@implementation KBEnvironment

- (instancetype)initWithConfig:(KBEnvConfig *)config {
  if ((self = [super init])) {
    _config = config;
    _service = [[KBService alloc] initWithConfig:config];

    KBHelperTool *helperTool = [[KBHelperTool alloc] initWithConfig:config];
    KBFuseComponent *fuse = [[KBFuseComponent alloc] initWithConfig:config];
    KBFSService *kbfs = [[KBFSService alloc] initWithConfig:config];
    // [[KBCLIInstall alloc] initWithConfig:config];

    _installables = [NSArray arrayWithObjects:_service, helperTool, fuse, kbfs, nil];
    _services = [NSArray arrayWithObjects:_service, kbfs, nil];
    _components = [NSMutableArray arrayWithObjects:_service, kbfs, helperTool, fuse, nil];

    NSArray *installables = _config.isInstallEnabled ? _installables : nil;
    _installActions = [installables map:^(id<KBInstallable> i) { return [KBInstallAction installActionWithInstallable:i]; }];
  }
  return self;
}

- (NSArray *)componentsForControlPanel {
  return _components;
}

- (NSArray *)installActionsNeeded {
  NSArray *installActions = [_installActions select:^BOOL(KBInstallAction *installAction) {
    return (installAction.installable.componentStatus.installStatus != KBInstallStatusInstalled ||
            installAction.installable.componentStatus.runtimeStatus == KBRuntimeStatusNotRunning);
  }];

  // Ignore KBFS since it's not ready yet
  installActions = [installActions select:^BOOL(KBInstallAction *installAction) {
    return ![installAction.name isEqual:@"KBFS"];
  }];

  return installActions;
}

- (void)installStatus:(void (^)(BOOL needsInstall))completion {
  KBRunOver *rover = [[KBRunOver alloc] init];
  rover.objects = _installActions;
  rover.runBlock = ^(KBInstallAction *installAction, KBRunCompletion runCompletion) {
    DDLogDebug(@"Checking %@", installAction.installable.name);
    [installAction.installable updateComponentStatus:^(NSError *error) {
      // Clear install outcome
      installAction.installAttempted = NO;
      installAction.installError = error;
      runCompletion(installAction);
    }];
  };
  rover.completion = ^(NSArray *installActions) {
    NSArray *installActionsNeeded = [self installActionsNeeded];
    completion([installActionsNeeded count] > 0);
  };
  [rover run];
}

- (void)uninstallServices:(KBCompletion)completion {
  KBRunOver *rover = [[KBRunOver alloc] init];
  rover.objects = [_services reverse];
  rover.runBlock = ^(id<KBInstallable> installable, KBRunCompletion runCompletion) {
    [installable uninstall:^(NSError *error) {
      runCompletion(installable);
    }];
  };
  rover.completion = ^(NSArray *outputs) {
    // TODO Check errors
    [self clearHome:completion];
  };
  [rover run];
}

- (void)clearHome:(KBCompletion)completion {
  BOOL isDirectory = NO;
  if ([NSFileManager.defaultManager fileExistsAtPath:_config.homeDir isDirectory:&isDirectory]) {
    if (!isDirectory) {
      completion(KBMakeError(-1, @"Home directory is not a directory"));
      return;
    }
    NSError *error = nil;
    if (![NSFileManager.defaultManager removeItemAtPath:_config.homeDir error:&error]) {
      completion(error);
    }
  }
}

@end
