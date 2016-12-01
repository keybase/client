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

  // Try to create/fix link as current user first
  if ([self createLinkForServicePath:self.servicePath name:self.config.serviceBinName]) {
    completion(nil);
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

- (BOOL)createLink:(NSString *)path linkPath:(NSString *)linkPath {
  if ([self linkExists:linkPath]) {
    [NSFileManager.defaultManager removeItemAtPath:linkPath error:nil];
  }
  if ([NSFileManager.defaultManager createSymbolicLinkAtPath:linkPath withDestinationPath:path error:nil]) {
    return YES;
  }
  return NO;
}

- (BOOL)createLinkForServicePath:(NSString *)directory name:(NSString *)name {
  NSString *path = [NSString stringWithFormat:@"%@/%@", directory, name];
  NSString *linkDir = @"/usr/local/bin";
  NSString *linkPath = [NSString stringWithFormat:@"%@/%@", linkDir, name];

  // Check if link dir exists at all
  if (![NSFileManager.defaultManager fileExistsAtPath:linkDir]) {
    DDLogError(@"%@ doesn't exist", linkDir);
    return NO;
  }

  // Check if we're linked properly at /usr/local/bin
  NSString *resolved = [self resolveLinkPath:linkPath];
  if ([resolved isEqualToString:path]) {
    DDLogDebug(@"%@ resolved to %@", linkPath, resolved);
    return YES;
  }

  // Create/fix the link
  DDLogDebug(@"Fixing symlink: %@, %@", linkPath, path);
  if (![self createLink:path linkPath:linkPath]) {
    DDLogError(@"Failed to create link: %@, %@", path, linkPath);
    return NO;
  } else {
    DDLogDebug(@"Created link: %@, %@", path, linkPath);
    return YES;
  }
}

@end
