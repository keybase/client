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
    completion(KBMakeError(-1, @"No service path"));
    return;
  }
  NSDictionary *params = @{@"directory": self.servicePath, @"name": @"Keybase"};
  DDLogDebug(@"Helper: addToPath(%@)", params);
  [self.helperTool.helper sendRequest:@"addToPath" params:@[params] completion:^(NSError *error, id value) {
    completion(error);
  }];
}

- (void)uninstall:(KBCompletion)completion {
  NSDictionary *params = @{@"name": @"Keybase"};
  DDLogDebug(@"Helper: removeFromPath(%@)", params);
  [self.helperTool.helper sendRequest:@"removeFromPath" params:@[params] completion:^(NSError *error, id value) {
    completion(error);
  }];
}

- (void)refreshComponent:(KBRefreshComponentCompletion)completion {
  NSString *path = @"/etc/paths.d/Keybase";
  if ([NSFileManager.defaultManager isReadableFileAtPath:path]) {
    NSError *error = nil;
    NSString *directory = [NSString stringWithContentsOfFile:path encoding:NSUTF8StringEncoding error:&error];
    if (error) {
      self.componentStatus = [KBComponentStatus componentStatusWithError:error];
      completion(self.componentStatus);
      return;
    }
    if ([directory isEqualToString:self.servicePath]) {
      self.componentStatus = [KBComponentStatus componentStatusWithInstallStatus:KBRInstallStatusInstalled installAction:KBRInstallActionNone info:nil error:nil];
    } else {
      self.componentStatus = [KBComponentStatus componentStatusWithInstallStatus:KBRInstallStatusInstalled installAction:KBRInstallActionUpgrade info:nil error:nil];
    }
  } else {
    self.componentStatus = [KBComponentStatus componentStatusWithInstallStatus:KBRInstallStatusNotInstalled installAction:KBRInstallActionInstall info:nil error:nil];
  }
  completion(self.componentStatus);
}

@end
