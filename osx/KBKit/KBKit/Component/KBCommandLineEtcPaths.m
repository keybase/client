//
//  KBCommandLineEtcPaths.m
//  KBKit
//
//  Created by Gabriel on 1/18/16.
//  Copyright © 2016 Gabriel Handford. All rights reserved.
//

#import "KBCommandLineEtcPaths.h"

@interface KBCommandLineEtcPaths ()
@property KBHelperTool *helperTool;
@property NSString *servicePath;
@end

@implementation KBCommandLineEtcPaths

- (instancetype)initWithConfig:(KBEnvConfig *)config helperTool:(KBHelperTool *)helperTool servicePath:(NSString *)servicePath {
  if ((self = [self initWithConfig:config name:@"CLI" info:@"Command Line" image:nil])) {
    _helperTool = helperTool;
    _servicePath = servicePath;
  }
  return self;
}

- (void)install:(KBCompletion)completion {
  if (!self.servicePath) {
    completion(KBMakeError(KBErrorCodeGeneric, @"No service path"));
    return;
  }

  if (![self.config isInApplications:self.servicePath] && ![self.config isInUserApplications:self.servicePath]) {
    completion(KBMakeWarning(@"Command line install is not supported from this location: %@", self.servicePath));
    return;
  }


  NSDictionary *params = @{@"directory": self.servicePath, @"name": self.config.serviceBinName, @"appName": self.config.appName};
  DDLogDebug(@"Helper: addToPath(%@)", params);
  [self.helperTool.helper sendRequest:@"addToPath" params:@[params] completion:^(NSError *error, id value) {
    DDLogDebug(@"Result: %@", value);
    completion(error);
  }];
}

- (void)uninstall:(KBCompletion)completion {
  NSDictionary *params = @{@"directory": self.servicePath, @"name": self.config.serviceBinName, @"appName": self.config.appName};
  DDLogDebug(@"Helper: removeFromPath(%@)", params);
  [self.helperTool.helper sendRequest:@"removeFromPath" params:@[params] completion:^(NSError *error, id value) {
    DDLogDebug(@"Result: %@", value);
    completion(error);
  }];
}

- (void)refreshComponent:(KBRefreshComponentCompletion)completion {
  // Also consider us installed if there is a file in /usr/local/bin/keybase
  NSString *linkDir = @"/usr/local/bin";
  NSString *linkPath = [NSString stringWithFormat:@"%@/%@", linkDir, self.config.serviceBinName];
  NSString *pathsdPath = [NSString stringWithFormat:@"/etc/paths.d/%@", self.config.appName];

  BOOL found = NO;
  NSArray *paths = @[linkPath, pathsdPath];
  for (NSString *path in paths) {
    if ([NSFileManager.defaultManager fileExistsAtPath:path]) {
      found = YES;
      break;
    }
  }

  if (found) {
    self.componentStatus = [KBComponentStatus componentStatusWithInstallStatus:KBRInstallStatusInstalled installAction:KBRInstallActionNone info:nil error:nil];
  } else {
    self.componentStatus = [KBComponentStatus componentStatusWithInstallStatus:KBRInstallStatusNotInstalled installAction:KBRInstallActionInstall info:nil error:nil];
  }

  completion(self.componentStatus);
}

@end
