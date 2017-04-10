//
//  KBLaunchdStatus.m
//  Keybase
//
//  Created by Gabriel on 5/11/15.
//  Copyright (c) 2015 Gabriel Handford. All rights reserved.
//

#import "KBLaunchdStatus.h"

#import "KBDefines.h"

@interface KBLaunchdStatus ()
@property NSString *label;
@property NSNumber *pid;
@property NSNumber *lastExitStatus;
@property NSError *error;
@end

@implementation KBLaunchdStatus

+ (instancetype)error:(NSError *)error {
  KBLaunchdStatus *serviceStatus = [[KBLaunchdStatus alloc] init];
  serviceStatus.error = error;
  return serviceStatus;
}

+ (instancetype)serviceStatusWithPid:(NSNumber *)pid lastExitStatus:(NSNumber *)lastExitStatus label:(NSString *)label {
  KBLaunchdStatus *serviceStatus = [[KBLaunchdStatus alloc] init];
  serviceStatus.pid = pid;
  serviceStatus.lastExitStatus = lastExitStatus;
  serviceStatus.label = label;
  return serviceStatus;
}

- (NSString *)info {
  return [NSString stringWithFormat:@"pid=%@, exit=%@", _pid, _lastExitStatus];
}

- (BOOL)isRunning {
  return (!!_pid);
}

@end
