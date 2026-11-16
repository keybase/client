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
#import "KBRunOver.h"
#import "KBDefines.h"
#import "KBCommandLine.h"
#import "KBMountDir.h"
#import "KBRedirector.h"
#import "KBAppBundle.h"

#import <ObjectiveSugar/ObjectiveSugar.h>

@interface KBEnvironment ()
@property KBEnvConfig *config;
@property KBFuseComponent *fuse;
@property NSMutableArray */*of KBInstallable*/installables;
@end

@implementation KBEnvironment

- (instancetype)initWithConfig:(KBEnvConfig *)config servicePath:(NSString *)servicePath {
  if ((self = [super init])) {
    _config = config;

    _installables = [NSMutableArray array];

    // Whether we need to install helper because a component needs it,
    // even if not specified as a component to install explicitly.
    BOOL helperRequired = NO;

    _helperTool = [[KBHelperTool alloc] initWithConfig:config];
    if (config.installOptions&KBInstallOptionHelper) {
      [_installables addObject:_helperTool];
    }

    if (config.installOptions&KBInstallOptionAppBundle) {
      helperRequired = YES;
      [_installables addObject:[[KBAppBundle alloc] initWithConfig:config helperTool:_helperTool]];
    }

    _fuse = [[KBFuseComponent alloc] initWithConfig:config helperTool:_helperTool servicePath:servicePath];
    if (config.installOptions&KBInstallOptionFuse) {
      helperRequired = YES;
      [_installables addObject:_fuse];
    }

    if (config.installOptions&KBInstallOptionMountDir) {
      helperRequired = YES;
      KBMountDir *mountDir = [[KBMountDir alloc] initWithConfig:config helperTool:_helperTool];
      [_installables addObject:mountDir];
    }

    if (config.installOptions&KBInstallOptionRedirector) {
      helperRequired = YES;
      KBRedirector *redirector = [[KBRedirector alloc] initWithConfig:config helperTool:_helperTool servicePath:servicePath];
      [_installables addObject:redirector];
    }

    _cli = [[KBCommandLine alloc] initWithConfig:config helperTool:_helperTool servicePath:servicePath];
    if (config.installOptions&KBInstallOptionCLI) {
      helperRequired = YES;
      [_installables addObject:_cli];
    }

    // If we have a component that needs the helper, make sure it's installed first.
    if (helperRequired && ![_installables containsObject:_helperTool]) {
      [_installables insertObject:_helperTool atIndex:0];
    }

  }
  return self;
}

@end
