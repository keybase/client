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
#import "KBUpdaterService.h"
#import "KBMountDir.h"
#import "KBRedirector.h"
#import "KBAppBundle.h"
#import "KBNM.h"

#import <ObjectiveSugar/ObjectiveSugar.h>

@interface KBEnvironment ()
@property KBEnvConfig *config;
@property KBService *service;
@property KBFSService *kbfs;
@property KBUpdaterService *updater;
@property KBFuseComponent *fuse;
@property NSMutableArray */*of id<KBComponent>*/components;
@property NSMutableArray */*of KBInstallable*/installables;
@property NSArray *services;
@property (nonatomic) NSDictionary *appConfig;
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

    _updater = [[KBUpdaterService alloc] initWithConfig:config label:[config launchdUpdaterLabel] servicePath:servicePath];
    if (config.installOptions&KBInstallOptionUpdater) {
      [_installables addObject:_updater];
    }

    _service = [[KBService alloc] initWithConfig:config label:[config launchdServiceLabel] servicePath:servicePath];
    if (config.installOptions&KBInstallOptionService) {
      [_installables addObject:_service];
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

    _kbfs = [[KBFSService alloc] initWithConfig:config label:[config launchdKBFSLabel] servicePath:servicePath];
    if (config.installOptions&KBInstallOptionKBFS) {
      [_installables addObject:_kbfs];
    }

    _cli = [[KBCommandLine alloc] initWithConfig:config helperTool:_helperTool servicePath:servicePath];
    if (config.installOptions&KBInstallOptionCLI) {
      helperRequired = YES;
      [_installables addObject:_cli];
    }

    if (config.installOptions&KBInstallOptionKBNM) {
      KBNM *kbnm = [[KBNM alloc] initWithConfig:config servicePath:servicePath];
      [_installables addObject:kbnm];
    }

    // If we have a component that needs the helper, make sure it's installed first.
    if (helperRequired && ![_installables containsObject:_helperTool]) {
      [_installables insertObject:_helperTool atIndex:0];
    }

    _services = [NSArray arrayWithObjects:_service, _kbfs, _updater, nil];
    _components = [NSMutableArray arrayWithObjects:_service, _kbfs, _helperTool, _fuse, _updater, nil];
  }
  return self;
}

- (NSArray *)componentsForControlPanel {
  return _components;
}

- (NSString *)debugInstallables {
  NSMutableString *info = [NSMutableString string];
  NSDictionary *installerInfo = NSBundle.mainBundle.infoDictionary;
  [info appendString:NSStringWithFormat(@"Installer: %@\n", installerInfo[@"CFBundleVersion"])];

  for (KBInstallable *installable in self.installables) {
    NSString *name = installable.name;
    [info appendString:NSStringWithFormat(@"%@: ", name)];
    NSString *action = [installable action];
    if (action) {
      [info appendString:NSStringWithFormat(@"%@, ", action)];
    }

    NSString *desc = [[installable installDescription:@", "] join:@", "];
    [info appendString:desc];

    [info appendString:@"\n"];
  }

  [info appendString:@"\n"];
  return info;
}

// Returns nil if config file isn't available
- (NSDictionary *)appConfig:(NSError **)error {
  // TODO: We should detect if changed and reload
  if (!_appConfig) {
    NSData *data = [NSData dataWithContentsOfFile:[_config dataPath:@"config.json" options:0]];
    if (!data) {
      return nil;
    }
    _appConfig = [NSJSONSerialization JSONObjectWithData:data options:kNilOptions error:error];
  }
  return _appConfig;
}

- (id)configValueForKey:(NSString *)keyPath defaultValue:(id)defaultValue error:(NSError **)error {
  NSDictionary *appConfig = [self appConfig:error];
  if (!appConfig) {
    return defaultValue;
  }
  id obj = [appConfig valueForKeyPath:keyPath];
  if (!obj) {
    obj = defaultValue;
  }
  return obj;
}

@end
