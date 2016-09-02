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

#import <ObjectiveSugar/ObjectiveSugar.h>

@interface KBEnvironment ()
@property KBEnvConfig *config;
@property KBFuseComponent *fuse;
@property NSMutableArray */*of id<KBComponent>*/components;
@property NSMutableArray */*of KBInstallable*/installables;
@property NSString *servicePath;
@property (nonatomic) NSDictionary *appConfig;
@property (nonatomic) KBService *service;
@end

@implementation KBEnvironment

- (instancetype)initWithConfig:(KBEnvConfig *)config servicePath:(NSString *)servicePath options:(KBInstallOptions)options {
  if ((self = [super init])) {
    _config = config;
    _servicePath = servicePath;

    _installables = [NSMutableArray array];

    _helperTool = [[KBHelperTool alloc] initWithConfig:config];
    if (options&KBInstallOptionHelper) {
      [_installables addObject:_helperTool];
    }

    _fuse = [[KBFuseComponent alloc] initWithConfig:config helperTool:_helperTool servicePath:servicePath];
    if (options&KBInstallOptionFuse) {
      [_installables addObject:_fuse];
    }

    if (options&KBInstallOptionMountDir) {
      KBMountDir *mountDir = [[KBMountDir alloc] initWithConfig:config helperTool:_helperTool];
      [_installables addObject:mountDir];
    }

    if (options&KBInstallOptionCLI) {
      KBCommandLine *cli = [[KBCommandLine alloc] initWithConfig:config helperTool:_helperTool servicePath:servicePath];
      [_installables addObject:cli];
    }

    _components = [NSMutableArray arrayWithObjects:_helperTool, _fuse, nil];
  }
  return self;
}

- (NSArray *)componentsForControlPanel {
  return _components;
}

+ (instancetype)environmentForRunModeString:(NSString *)runModeString servicePath:(NSString *)servicePath options:(KBInstallOptions)options {
  if ([runModeString isEqualToString:@"prod"]) {
    return [[KBEnvironment alloc] initWithConfig:[KBEnvConfig envConfigWithRunMode:KBRunModeProd] servicePath:servicePath options:options];
  } else if ([runModeString isEqualToString:@"staging"]) {
    return [[KBEnvironment alloc] initWithConfig:[KBEnvConfig envConfigWithRunMode:KBRunModeStaging] servicePath:servicePath options:options];
  } else if ([runModeString isEqualToString:@"devel"]) {
    return [[KBEnvironment alloc] initWithConfig:[KBEnvConfig envConfigWithRunMode:KBRunModeDevel] servicePath:servicePath options:options];
  }
  return nil;
}

- (KBService *)service {
  if (!_service) {
    _service = [[KBService alloc] initWithConfig:_config label:[_config launchdServiceLabel] servicePath:_servicePath];
  }
  return _service;
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
