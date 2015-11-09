//
//  KBEnvironment.m
//  Keybase
//
//  Created by Gabriel on 4/22/15.
//  Copyright (c) 2015 Gabriel Handford. All rights reserved.
//

#import "KBEnvironment.h"

#import <KBKit/KBHelperTool.h>
#import <KBKit/KBFuseComponent.h>
#import <KBKit/KBRunOver.h>

#import <ObjectiveSugar/ObjectiveSugar.h>
#import <KBKit/KBDefines.h>
#import <KBKit/KBInstallAction.h>

@interface KBEnvironment ()
@property KBEnvConfig *config;
@property KBService *service;
@property KBFSService *kbfs;
@property NSMutableArray */*of id<KBComponent>*/components;
@property NSArray */*of id<KBInstallable>*/installables;
@property NSArray */*of KBInstallAction*/installActions;
@property NSArray *services;
@end

@implementation KBEnvironment

- (instancetype)initWithConfig:(KBEnvConfig *)config {
  if ((self = [super init])) {
    _config = config;
    _service = [[KBService alloc] initWithConfig:config label:[config launchdServiceLabel]];

    KBHelperTool *helperTool = [[KBHelperTool alloc] initWithConfig:config];
    KBFuseComponent *fuse = [[KBFuseComponent alloc] initWithConfig:config helperTool:helperTool];
    _kbfs = [[KBFSService alloc] initWithConfig:config label:[config launchdKBFSLabel]];

    _installables = [NSArray arrayWithObjects:_service, helperTool, fuse, _kbfs, nil];
    _services = [NSArray arrayWithObjects:_service, _kbfs, nil];
    _components = [NSMutableArray arrayWithObjects:_service, _kbfs, helperTool, fuse, nil];

    _installActions = [_installables map:^(id<KBInstallable> i) { return [KBInstallAction installActionWithInstallable:i]; }];
  }
  return self;
}

- (NSArray *)componentsForControlPanel {
  return _components;
}

- (NSArray *)installActionsNeeded {
  return [_installActions select:^BOOL(KBInstallAction *installAction) {
    return (!installAction.installable.isInstallDisabled &&
            ([installAction.installable.componentStatus needsInstallOrUpgrade]));
  }];
}

@end
