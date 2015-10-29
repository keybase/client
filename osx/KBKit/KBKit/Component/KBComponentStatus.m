//
//  KBComponent.m
//  Keybase
//
//  Created by Gabriel on 5/13/15.
//  Copyright (c) 2015 Gabriel Handford. All rights reserved.
//

#import "KBComponentStatus.h"

#import <ObjectiveSugar/ObjectiveSugar.h>

@interface KBComponentStatus ()
@property NSError *error;
@property KBRInstallStatus installStatus;
@property KBRuntimeStatus runtimeStatus;
@property GHODictionary *info;
@end

@implementation KBComponentStatus

+ (instancetype)componentStatusWithError:(NSError *)error {
  KBComponentStatus *componentStatus = [[KBComponentStatus alloc] init];
  componentStatus.error = error;
  componentStatus.installStatus = KBRInstallStatusError;
  return componentStatus;
}

+ (instancetype)componentStatusWithInstallStatus:(KBRInstallStatus)installStatus {
  KBComponentStatus *componentStatus = [[KBComponentStatus alloc] init];
  componentStatus.installStatus = installStatus;
  return componentStatus;
}

+ (instancetype)componentStatusWithInstallStatus:(KBRInstallStatus)installStatus runtimeStatus:(KBRuntimeStatus)runtimeStatus {
  KBComponentStatus *componentStatus = [[KBComponentStatus alloc] init];
  componentStatus.installStatus = installStatus;
  componentStatus.runtimeStatus = runtimeStatus;
  return componentStatus;
}

+ (instancetype)componentStatusWithInstallStatus:(KBRInstallStatus)installStatus runtimeStatus:(KBRuntimeStatus)runtimeStatus info:(GHODictionary *)info {
  KBComponentStatus *componentStatus = [[KBComponentStatus alloc] init];
  componentStatus.installStatus = installStatus;
  componentStatus.runtimeStatus = runtimeStatus;
  componentStatus.info = info;
  return componentStatus;
}

+ (instancetype)componentStatusWithServiceStatus:(KBRServiceStatus *)serviceStatus {
  KBComponentStatus *componentStatus = [[KBComponentStatus alloc] init];
  componentStatus.installStatus = serviceStatus.installStatus;
  componentStatus.runtimeStatus = ![serviceStatus.pid isEqualToString:@""] ? KBRuntimeStatusRunning : KBRuntimeStatusNotRunning;

  GHODictionary *info = [GHODictionary dictionary];
  info[@"Status Error"] = serviceStatus.error.message;
  info[@"Version"] = KBIfBlank(serviceStatus.version, nil);

  if (![serviceStatus.version isEqualToString:serviceStatus.bundleVersion]) {
    info[@"Bundle Version"] = KBIfBlank(serviceStatus.bundleVersion, nil);
  }

  //info[@"PID"] = KBIfBlank(serviceStatus.pid, nil);
  info[@"Exit Status"] = KBIfBlank(serviceStatus.lastExitStatus, nil);
  componentStatus.info = info;
  
  return componentStatus;
}

- (BOOL)needsInstallOrUpgrade {
  return _installStatus == KBRInstallStatusNotInstalled || _installStatus == KBRInstallStatusNeedsUpgrade;
}

- (NSString *)actionLabel {
  switch (_installStatus) {
    case KBRInstallStatusUnknown: return @"Unknown";
    case KBRInstallStatusNeedsUpgrade: return @"Upgrade";
    case KBRInstallStatusInstalled: return @"Uninstall";
    case KBRInstallStatusNotInstalled: return @"Install";
    case KBRInstallStatusError: return @"Error";
  }
}

- (NSString *)statusDescription {
  NSMutableArray *str = [NSMutableArray array];

  if (_runtimeStatus != KBRuntimeStatusNone) {
    [str addObject:NSStringWithFormat(@"%@, %@", NSStringFromKBRuntimeStatus(_runtimeStatus), NSStringFromKBRInstallStatus(_installStatus))];
  } else {
    [str addObject:NSStringFromKBRInstallStatus(_installStatus)];
  }

  NSMutableArray *infos = [NSMutableArray array];
  for (id key in _info) {
    [infos addObject:NSStringWithFormat(@"%@: %@", key, _info[key])];
  }
  if ([infos count] > 0) [str addObject:NSStringWithFormat(@"\n%@", [infos join:@"\n"])];

  return [str join:@" "];
}

@end

NSString *NSStringFromKBRInstallStatus(KBRInstallStatus status) {
  switch (status) {
    case KBRInstallStatusError: return @"Error";
    case KBRInstallStatusUnknown: return @"Unknown";
    case KBRInstallStatusNotInstalled: return @"Not Installed";
    case KBRInstallStatusNeedsUpgrade: return @"Needs Upgrade";
    case KBRInstallStatusInstalled: return @"Installed";
  }
}

NSString *NSStringFromKBRuntimeStatus(KBRuntimeStatus status) {
  switch (status) {
    case KBRuntimeStatusNone: return @"-";
    case KBRuntimeStatusNotRunning: return @"Not Running";
    case KBRuntimeStatusRunning: return @"Running";
  }
}
