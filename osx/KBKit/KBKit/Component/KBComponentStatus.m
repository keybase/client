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
@property KBRInstallAction installAction;
@property GHODictionary *info;
@property NSString *label;
@end

@implementation KBComponentStatus

+ (instancetype)componentStatusWithVersion:(KBSemVersion *)version bundleVersion:(KBSemVersion *)bundleVersion info:(GHODictionary *)info {
  if (version && bundleVersion) {
    if ([bundleVersion isGreaterThan:version]) {
      return [KBComponentStatus componentStatusWithInstallStatus:KBRInstallStatusInstalled installAction:KBRInstallActionUpgrade info:info error:nil];
    } else {
      return [KBComponentStatus componentStatusWithInstallStatus:KBRInstallStatusInstalled installAction:KBRInstallActionNone info:info error:nil];
    }
  } else if (version && !bundleVersion) {
    return [KBComponentStatus componentStatusWithInstallStatus:KBRInstallStatusInstalled installAction:KBRInstallActionNone info:info error:nil];
  } else if (!version && bundleVersion) {
    return [KBComponentStatus componentStatusWithInstallStatus:KBRInstallStatusNotInstalled installAction:KBRInstallActionInstall info:info error:nil];
  }
  return [KBComponentStatus componentStatusWithInstallStatus:KBRInstallStatusUnknown installAction:KBRInstallActionNone info:info error:nil];
}

+ (instancetype)componentStatusWithInstallStatus:(KBRInstallStatus)installStatus installAction:(KBRInstallAction)installAction info:(GHODictionary *)info error:(NSError *)error {
  KBComponentStatus *componentStatus = [[KBComponentStatus alloc] init];
  componentStatus.installStatus = installStatus;
  componentStatus.installAction = installAction;
  componentStatus.info = info;
  componentStatus.error = error;
  return componentStatus;
}

+ (instancetype)componentStatusWithError:(NSError *)error {
  KBComponentStatus *componentStatus = [[KBComponentStatus alloc] init];
  componentStatus.installStatus = KBRInstallStatusError;
  componentStatus.installAction = KBRInstallActionNone;
  componentStatus.error = error;
  return componentStatus;
}

+ (instancetype)componentStatusWithServiceStatus:(KBRServiceStatus *)serviceStatus {
  KBComponentStatus *componentStatus = [[KBComponentStatus alloc] init];
  componentStatus.installStatus = serviceStatus.installStatus;
  componentStatus.installAction = serviceStatus.installAction;
  if (serviceStatus.status.code > 0) {
    componentStatus.error = KBMakeError(serviceStatus.status.code, @"%@", serviceStatus.status.desc);
  }
  componentStatus.label = serviceStatus.label;

  GHODictionary *info = [GHODictionary dictionary];
  info[@"Version"] = KBIfBlank(serviceStatus.version, nil);

  if (![serviceStatus.version isEqualToString:serviceStatus.bundleVersion]) {
    info[@"Bundle Version"] = KBIfBlank(serviceStatus.bundleVersion, nil);
  }

  info[@"PID"] = KBIfBlank(serviceStatus.pid, nil);
  info[@"Exit Status"] = KBIfBlank(serviceStatus.lastExitStatus, nil);

  componentStatus.info = info;
  
  return componentStatus;
}

- (BOOL)needsInstallOrUpgrade {
  return _installAction == KBRInstallActionInstall
    || _installAction == KBRInstallActionUpgrade
    || _installAction == KBRInstallActionReinstall;
}

- (GHODictionary *)statusInfo {
  GHODictionary *info = [GHODictionary dictionary];

  if (self.error) {
    info[@"Error"] = [self.error localizedDescription];
  }

  if (_info) [info addEntriesFromOrderedDictionary:_info];
  info[@"Label"] = self.label;
  info[@"Install Status"] = NSStringFromKBRInstallStatus(self.installStatus);
  info[@"Install Action"] = NSStringFromKBRInstallAction(self.installAction);
  return info;
}

- (NSString *)statusDescription:(NSString *)delimeter {
  NSMutableArray *str = [NSMutableArray array];
  [str addObject:NSStringFromKBRInstallStatus(_installStatus)];
  
  NSMutableArray *infos = [NSMutableArray array];
  for (id key in _info) {
    [infos addObject:NSStringWithFormat(@"%@: %@", key, _info[key])];
  }
  if ([infos count] > 0) [str addObject:[infos join:delimeter]];

  return [str join:@", "];
}

@end

NSString *NSStringFromKBRInstallAction(KBRInstallAction action) {
  switch (action) {
    case KBRInstallActionNone: return nil;
    case KBRInstallActionUnknown: return @"Unknown";
    case KBRInstallActionInstall: return @"Install";
    case KBRInstallActionUpgrade: return @"Upgrade";
    case KBRInstallActionReinstall: return @"Re-Install";
  }
}

NSString *NSStringFromKBRInstallStatus(KBRInstallStatus status) {
  switch (status) {
    case KBRInstallStatusError: return @"Error";
    case KBRInstallStatusUnknown: return @"Unknown";
    case KBRInstallStatusNotInstalled: return @"Not Installed";
    case KBRInstallStatusInstalled: return @"Installed";
  }
}
