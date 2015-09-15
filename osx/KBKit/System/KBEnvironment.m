//
//  KBEnvironment.m
//  Keybase
//
//  Created by Gabriel on 4/22/15.
//  Copyright (c) 2015 Gabriel Handford. All rights reserved.
//

#import "KBEnvironment.h"

#import "KBHelperTool.h"
#import "KBFuseComponent.h"
#import "KBCLIInstall.h"
#import "KBRunOver.h"

#import <ObjectiveSugar/ObjectiveSugar.h>
#import "KBDefines.h"

@interface KBEnvironment ()
@property KBEnvConfig *config;
@property KBService *service;
@property KBFSService *kbfs;
@property NSMutableArray */*of id<KBComponent>*/components;
@property NSArray */*of id<KBInstallable>*/installables;
@property NSArray */*of KBInstallAction*/installActions;

@property NSArray */*of KBLaunchService*/services;
@end

@implementation KBEnvironment

- (instancetype)initWithConfig:(KBEnvConfig *)config serviceLabel:(NSString *)serviceLabel {
  if ((self = [super init])) {
    _config = config;
    _service = [[KBService alloc] initWithConfig:config label:serviceLabel];

    KBHelperTool *helperTool = [[KBHelperTool alloc] initWithConfig:config];
    KBFuseComponent *fuse = [[KBFuseComponent alloc] initWithConfig:config];
    _kbfs = [[KBFSService alloc] initWithConfig:config label:[config launchdKBFSLabel]];

    _installables = [NSArray arrayWithObjects:_service, helperTool, fuse, _kbfs, nil];
    _services = [NSArray arrayWithObjects:_service, _kbfs, nil];
    _components = [NSMutableArray arrayWithObjects:_service, _kbfs, helperTool, fuse, nil];

    NSArray *installables = !!serviceLabel ? _installables : nil;
    _installActions = [installables map:^(id<KBInstallable> i) { return [KBInstallAction installActionWithInstallable:i]; }];
  }
  return self;
}

+ (void)lookupForConfig:(KBEnvConfig *)config completion:(void (^)(KBEnvironment *environment))completion {
  [KBService lookup:config completion:^(NSError *error, NSString *label) {
    completion([[KBEnvironment alloc] initWithConfig:config serviceLabel:label]);
  }];
}

- (NSArray *)componentsForControlPanel {
  return _components;
}

- (NSArray *)installActionsNeeded {
  return [_installActions select:^BOOL(KBInstallAction *installAction) {
    return (!installAction.installable.isInstallDisabled &&
            (installAction.installable.componentStatus.installStatus != KBInstallStatusInstalled ||
             installAction.installable.componentStatus.runtimeStatus == KBRuntimeStatusNotRunning));
  }];
}

@end
