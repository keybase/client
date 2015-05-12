//
//  KBServiceStatus.m
//  Keybase
//
//  Created by Gabriel on 5/11/15.
//  Copyright (c) 2015 Gabriel Handford. All rights reserved.
//

#import "KBServiceStatus.h"

@interface KBServiceStatus ()
@property NSString *label;
@property NSNumber *pid;
@property NSNumber *exitStatus;
@property NSError *error;
@end

@implementation KBServiceStatus

+ (instancetype)error:(NSError *)error {
  KBServiceStatus *serviceStatus = [[KBServiceStatus alloc] init];
  serviceStatus.error = error;
  return serviceStatus;
}

+ (instancetype)serviceStatusWithPid:(NSNumber *)pid exitStatus:(NSNumber *)exitStatus label:(NSString *)label {
  KBServiceStatus *serviceStatus = [[KBServiceStatus alloc] init];
  serviceStatus.pid = pid;
  serviceStatus.exitStatus = exitStatus;
  serviceStatus.label = label;
  return serviceStatus;
}

- (NSString *)info {
  return [NSString stringWithFormat:@"pid=%@, exit=%@", _pid, _exitStatus];
}

- (BOOL)isRunning {
  return (_exitStatus && [_exitStatus integerValue] == 0);
}

@end
