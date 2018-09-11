//
//  KBNM.m
//  KBKit
//
//  Created by Gabriel on 4/6/17.
//  Copyright © 2017 Gabriel Handford. All rights reserved.
//

#import "KBNM.h"

#import "KBTask.h"
#import "KBIcons.h"

@interface KBNM ()
@property NSString *servicePath;
@end

@implementation KBNM

- (instancetype)initWithConfig:(KBEnvConfig *)config servicePath:(NSString *)servicePath {
  if ((self = [self initWithConfig:config name:@"KBNM" info:@"Chrome native messaging" image:[KBIcons imageForIcon:KBIconNetwork]])) {
    _servicePath = servicePath;
  }
  return self;
}

- (KBInstallRuntimeStatus)runtimeStatus {
  return KBInstallRuntimeStatusNone;
}

- (void)install:(KBCompletion)completion {
  NSString *binPath = [self.config serviceBinPathWithPathOptions:0 servicePath:_servicePath];
  [KBTask executeForJSONWithCommand:binPath args:@[@"-d", @"--log-format=file", @"install", @"--format=json", @"--components=kbnm", NSStringWithFormat(@"--timeout=%@s", @(self.config.installTimeout))] timeout:KBDefaultTaskTimeout completion:^(NSError *error, id response) {
    if (!error) error = [KBInstallable checkForStatusErrorFromResponse:response];
    completion(error);
  }];
}

- (void)uninstall:(KBCompletion)completion {
  NSString *binPath = [self.config serviceBinPathWithPathOptions:0 servicePath:_servicePath];
  [KBTask execute:binPath args:@[@"-d", @"--log-format=file", @"uninstall", @"--components=kbnm"] timeout:KBDefaultTaskTimeout completion:^(NSError *error, NSData *outData, NSData *errData) {
    completion(error);
  }];
}

- (void)refreshComponent:(KBRefreshComponentCompletion)completion {
  completion(nil);
}

@end
