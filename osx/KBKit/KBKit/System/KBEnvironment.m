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

@interface KBEnvironment ()
@property KBEnvConfig *config;
@property KBService *service;
@property KBFSService *kbfs;
@property NSMutableArray */*of id<KBComponent>*/components;
@property NSArray */*of KBInstallable*/installables;
@property NSArray *services;
@end


@implementation KBEnvironment

- (instancetype)initWithConfig:(KBEnvConfig *)config servicePath:(NSString *)servicePath {
  if ((self = [super init])) {
    _config = config;
    KBHelperTool *helperTool = [[KBHelperTool alloc] initWithConfig:config];

    _service = [[KBService alloc] initWithConfig:config label:[config launchdServiceLabel] servicePath:servicePath];
    _kbfs = [[KBFSService alloc] initWithConfig:config helperTool:helperTool label:[config launchdKBFSLabel] servicePath:servicePath];

    KBFuseComponent *fuse = [[KBFuseComponent alloc] initWithConfig:config helperTool:helperTool servicePath:servicePath];

    _installables = [NSArray arrayWithObjects:helperTool, _service, fuse, _kbfs, nil];

    _services = [NSArray arrayWithObjects:_service, _kbfs, nil];
    _components = [NSMutableArray arrayWithObjects:_service, _kbfs, helperTool, fuse, nil];
  }
  return self;
}

- (NSArray *)componentsForControlPanel {
  return _components;
}

+ (instancetype)environmentForRunModeString:(NSString *)runModeString servicePath:(NSString *)servicePath {
  if ([runModeString isEqualToString:@"prod"]) {
    return [[KBEnvironment alloc] initWithConfig:[KBEnvConfig envConfigWithRunMode:KBRunModeProd] servicePath:servicePath];
  } else if ([runModeString isEqualToString:@"staging"]) {
    return [[KBEnvironment alloc] initWithConfig:[KBEnvConfig envConfigWithRunMode:KBRunModeStaging] servicePath:servicePath];
  } else if ([runModeString isEqualToString:@"devel"]) {
    return [[KBEnvironment alloc] initWithConfig:[KBEnvConfig envConfigWithRunMode:KBRunModeDevel] servicePath:servicePath];
  }
  return nil;
}

@end
