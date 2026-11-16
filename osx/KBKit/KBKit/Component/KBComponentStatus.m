//
//  KBComponentStatus.m
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
@end

@implementation KBComponentStatus

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

- (BOOL)needsInstallOrUpgrade {
  return _installAction == KBRInstallActionInstall
    || _installAction == KBRInstallActionUpgrade
    || _installAction == KBRInstallActionReinstall;
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

NSString *NSStringFromKBRInstallStatus(KBRInstallStatus status) {
  switch (status) {
    case KBRInstallStatusError: return @"Error";
    case KBRInstallStatusUnknown: return @"Unknown";
    case KBRInstallStatusNotInstalled: return @"Not Installed";
    case KBRInstallStatusInstalled: return @"Installed";
  }
}
