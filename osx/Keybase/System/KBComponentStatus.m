//
//  KBComponent.m
//  Keybase
//
//  Created by Gabriel on 5/13/15.
//  Copyright (c) 2015 Gabriel Handford. All rights reserved.
//

#import "KBComponentStatus.h"
#import "KBAppDefines.h"

@interface KBComponentStatus ()
@property NSError *error;
@property KBInstallStatus installStatus;
@property KBRuntimeStatus runtimeStatus;
@property GHODictionary *info;
@end

@implementation KBComponentStatus

+ (instancetype)componentStatusWithError:(NSError *)error {
  KBComponentStatus *componentStatus = [[KBComponentStatus alloc] init];
  componentStatus.error = error;
  componentStatus.installStatus = KBInstallStatusError;
  return componentStatus;
}

+ (instancetype)componentStatusWithInstallStatus:(KBInstallStatus)installStatus {
  KBComponentStatus *componentStatus = [[KBComponentStatus alloc] init];
  componentStatus.installStatus = installStatus;
  return componentStatus;
}

+ (instancetype)componentStatusWithInstallStatus:(KBInstallStatus)installStatus runtimeStatus:(KBRuntimeStatus)runtimeStatus {
  KBComponentStatus *componentStatus = [[KBComponentStatus alloc] init];
  componentStatus.installStatus = installStatus;
  componentStatus.runtimeStatus = runtimeStatus;
  return componentStatus;
}

+ (instancetype)componentStatusWithInstallStatus:(KBInstallStatus)installStatus runtimeStatus:(KBRuntimeStatus)runtimeStatus info:(GHODictionary *)info {
  KBComponentStatus *componentStatus = [[KBComponentStatus alloc] init];
  componentStatus.installStatus = installStatus;
  componentStatus.runtimeStatus = runtimeStatus;
  componentStatus.info = info;
  return componentStatus;
}

- (BOOL)needsInstallOrUpgrade {
  return _installStatus == KBInstallStatusNotInstalled || _installStatus == KBInstallStatusNeedsUpgrade;
}

- (NSString *)actionLabel {
  switch (_installStatus) {
    case KBInstallStatusNeedsUpgrade: return @"Upgrade";
    case KBInstallStatusInstalled: return @"Uninstall";
    case KBInstallStatusNotInstalled: return @"Install";
    case KBInstallStatusError: return @"Error";
  }
}

- (NSString *)statusDescription {
  NSMutableArray *str = [NSMutableArray array];

  if (_runtimeStatus == KBRuntimeStatusNotRunning) {
    [str addObject:NSStringFromKBRuntimeStatus(_runtimeStatus)];
  } else {
    [str addObject:NSStringFromKBInstallStatus(_installStatus)];
  }

  NSMutableArray *infos = [NSMutableArray array];
  for (id key in _info) {
    [infos addObject:NSStringWithFormat(@"%@: %@", key, _info[key])];
  }
  if ([infos count] > 0) [str addObject:NSStringWithFormat(@"\n%@", [infos join:@", "])];

  return [str join:@" "];
}

@end

NSString *NSStringFromKBInstallStatus(KBInstallStatus status) {
  switch (status) {
    case KBInstallStatusError: return @"Error";
    case KBInstallStatusNotInstalled: return @"Not Installed";
    case KBInstallStatusNeedsUpgrade: return @"Needs Upgrade";
    case KBInstallStatusInstalled: return @"Installed";
  }
}

NSString *NSStringFromKBRuntimeStatus(KBRuntimeStatus status) {
  switch (status) {
    case KBRuntimeStatusNone: return @"N/A";
    case KBRuntimeStatusNotRunning: return @"Not Running";
    case KBRuntimeStatusRunning: return @"Running";
  }
}
