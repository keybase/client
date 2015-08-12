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

#import <ObjectiveSugar/ObjectiveSugar.h>
#import "KBDefines.h"

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
  return [_installActions select:^BOOL(KBInstallAction *installAction) {
    return (installAction.installable.componentStatus.installStatus != KBInstallStatusInstalled ||
            installAction.installable.componentStatus.runtimeStatus == KBRuntimeStatusNotRunning);
  }];
}

- (void)installStatus:(void (^)(BOOL needsInstall))completion {
  KBRunOver *rover = [[KBRunOver alloc] init];
  rover.enumerator = [_installActions objectEnumerator];
  rover.runBlock = ^(KBInstallAction *installAction, KBRunCompletion runCompletion) {
    DDLogDebug(@"Checking %@", installAction.installable.name);
    [installAction.installable refreshComponent:^(NSError *error) {
      // Clear install outcome
      installAction.installAttempted = NO;
      installAction.installError = error;
      runCompletion(installAction);
    }];
  };
  rover.completion = ^(NSArray *installActions) {
    NSArray *installActionsNeeded = [self installActionsNeeded];
    //DDLogDebug(@"Install actions needed: %@", installActionsNeeded);
    completion([installActionsNeeded count] > 0);
  };
  [rover run];
}

- (void)uninstall:(KBCompletion)completion {
  KBRunOver *rover = [[KBRunOver alloc] init];
  rover.enumerator = [_installables reverseObjectEnumerator];
  rover.runBlock = ^(id<KBInstallable> installable, KBRunCompletion runCompletion) {
    [installable uninstall:^(NSError *error) {
      runCompletion(installable);
    }];
  };
  rover.completion = ^(NSArray *outputs) {
    completion(nil);
  };
  [rover run];
}

@end
