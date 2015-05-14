//
//  KBInstallStatus.m
//  Keybase
//
//  Created by Gabriel on 5/13/15.
//  Copyright (c) 2015 Gabriel Handford. All rights reserved.
//

#import "KBInstallStatus.h"
#import "KBAppDefines.h"

@interface KBInstallStatus ()
@property NSError *error;
@property KBInstalledStatus status;
@property KBRuntimeStatus runtimeStatus;
@property GHODictionary *info;
@end

@implementation KBInstallStatus

+ (instancetype)installStatusWithError:(NSError *)error {
  KBInstallStatus *installStatus = [[KBInstallStatus alloc] init];
  installStatus.error = error;
  installStatus.status = KBInstalledStatusError;
  return installStatus;
}

+ (instancetype)installStatusWithStatus:(KBInstalledStatus)status {
  KBInstallStatus *installStatus = [[KBInstallStatus alloc] init];
  installStatus.status = status;
  return installStatus;
}

+ (instancetype)installStatusWithStatus:(KBInstalledStatus)status runtimeStatus:(KBRuntimeStatus)runtimeStatus {
  KBInstallStatus *installStatus = [[KBInstallStatus alloc] init];
  installStatus.status = status;
  installStatus.runtimeStatus = runtimeStatus;
  return installStatus;
}

+ (instancetype)installStatusWithStatus:(KBInstalledStatus)status runtimeStatus:(KBRuntimeStatus)runtimeStatus info:(GHODictionary *)info {
  KBInstallStatus *installStatus = [[KBInstallStatus alloc] init];
  installStatus.status = status;
  installStatus.runtimeStatus = runtimeStatus;
  installStatus.info = info;
  return installStatus;
}

- (NSString *)statusDescription {
  NSMutableArray *str = [NSMutableArray array];

  if (_runtimeStatus == KBRuntimeStatusNotRunning) {
    [str addObject:@"Not Running"];
  } else {
    [str addObject:NSStringFromKBInstalledStatus(_status)];
  }

  NSMutableArray *infos = [NSMutableArray array];
  for (id key in _info) {
    [infos addObject:NSStringWithFormat(@"%@: %@", key, _info[key])];
  }
  if ([infos count] > 0) [str addObject:NSStringWithFormat(@"(%@)", [infos join:@", "])];

  return [str join:@" "];
}

@end

NSString *NSStringFromKBInstalledStatus(KBInstalledStatus status) {
  switch (status) {
    case KBInstalledStatusError: return @"Error";
    case KBInstalledStatusNotInstalled: return @"Not Installed";
    case KBInstalledStatusNeedsUpgrade: return @"Needs Upgrade";
    case KBInstalledStatusInstalled: return @"Installed";
  }
}
