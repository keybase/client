//
//  KBCommandLine.m
//  KBKit
//
//  Created by Gabriel on 1/18/16.
//  Copyright © 2016 Gabriel Handford. All rights reserved.
//

#import "KBCommandLine.h"

@interface KBCommandLine ()
@property KBHelperTool *helperTool;
@property NSString *servicePath;
@end

@implementation KBCommandLine

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

- (BOOL)linkExists:(NSString *)linkPath {
  NSDictionary *attributes = [NSFileManager.defaultManager attributesOfItemAtPath:linkPath error:nil];
  if (!attributes) {
    return NO;
  }
  return [attributes[NSFileType] isEqual:NSFileTypeSymbolicLink];
}

- (NSString *)resolveLinkPath:(NSString *)linkPath {
  if (![self linkExists:linkPath]) {
    return nil;
  }
  return [NSFileManager.defaultManager destinationOfSymbolicLinkAtPath:linkPath error:nil];
}

// Check if we're linked properly at /usr/local/bin
- (BOOL)linkedToServicePath {
  NSString *linkDir = @"/usr/local/bin";
  NSString *linkPath = [NSString stringWithFormat:@"%@/%@", linkDir, self.config.serviceBinName];
  NSString *shouldResolveToPath = [NSString stringWithFormat:@"%@/%@", self.servicePath, self.config.serviceBinName];
  if ([NSFileManager.defaultManager fileExistsAtPath:linkDir]) {
    NSString *resolved = [self resolveLinkPath:linkPath];
    DDLogInfo(@"Link resolved to path: %@ <=> %@", resolved, shouldResolveToPath);
    if ([resolved isEqualToString:shouldResolveToPath]) {
      return YES;
    }
  }
  return NO;
}

- (BOOL)etcPathsExists {
  NSString *pathsdPath = [NSString stringWithFormat:@"/etc/paths.d/%@", self.config.appName];
  BOOL exists = [NSFileManager.defaultManager fileExistsAtPath:pathsdPath];
  DDLogInfo(@"%@ exists? %@", pathsdPath, @(exists));
  return exists;
}

- (void)refreshComponent:(KBRefreshComponentCompletion)completion {
  BOOL installed = [self linkedToServicePath] || [self etcPathsExists];
  if (installed) {
    self.componentStatus = [KBComponentStatus componentStatusWithInstallStatus:KBRInstallStatusInstalled installAction:KBRInstallActionNone info:nil error:nil];
  } else {
    self.componentStatus = [KBComponentStatus componentStatusWithInstallStatus:KBRInstallStatusNotInstalled installAction:KBRInstallActionInstall info:nil error:nil];
  }

  completion(self.componentStatus);
}

@end
