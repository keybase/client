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

#import <ObjectiveSugar/ObjectiveSugar.h>

@interface KBEnvironment ()
@property KBEnvConfig *config;
@property KBService *service;
@property KBFSService *kbfs;
@property KBFuseComponent *fuse;
@property NSMutableArray */*of id<KBComponent>*/components;
@property NSArray */*of KBInstallable*/installables;
@property NSArray *services;
@property (nonatomic) NSDictionary *appConfig;
@end


@implementation KBEnvironment

- (instancetype)initWithConfig:(KBEnvConfig *)config servicePath:(NSString *)servicePath {
  if ((self = [super init])) {
    _config = config;
    KBHelperTool *helperTool = [[KBHelperTool alloc] initWithConfig:config];

    _service = [[KBService alloc] initWithConfig:config label:[config launchdServiceLabel] servicePath:servicePath];
    _kbfs = [[KBFSService alloc] initWithConfig:config helperTool:helperTool label:[config launchdKBFSLabel] servicePath:servicePath];

    _fuse = [[KBFuseComponent alloc] initWithConfig:config helperTool:helperTool servicePath:servicePath];
    KBCommandLine *cli = [[KBCommandLine alloc] initWithConfig:config helperTool:helperTool servicePath:servicePath];

    _installables = [NSArray arrayWithObjects:helperTool, _service, _fuse, _kbfs, cli, nil];

    _services = [NSArray arrayWithObjects:_service, _kbfs, nil];
    _components = [NSMutableArray arrayWithObjects:_service, _kbfs, helperTool, _fuse, nil];
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
    NSData *data = [NSData dataWithContentsOfFile:[_config appPath:@"config.json" options:0]];
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
