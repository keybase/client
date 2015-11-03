//
//  KBLaunchdPlist.m
//  Keybase
//
//  Created by Gabriel on 10/26/15.
//  Copyright © 2015 Keybase. All rights reserved.
//

#import "KBLaunchdPlist.h"

#import <ObjectiveSugar/ObjectiveSugar.h>
#import "KBPath.h"

@interface KBLaunchdPlist ()
@property NSString *label;
@property NSString *binPath;
@property NSString *runtimeDir;
@property NSString *logPath;
@property NSArray *args;
@end

@implementation KBLaunchdPlist

- (instancetype)initWithLabel:(NSString *)label binPath:(NSString *)binPath runtimeDir:(NSString *)runtimeDir logPath:(NSString *)logPath args:(NSArray *)args {
  if ((self = [self init])) {
    _label = label;
    _binPath = binPath;
    _runtimeDir = runtimeDir;
    _args = args;
  }
  return self;
}

- (NSDictionary *)envs {
  NSMutableDictionary *envs = [NSMutableDictionary dictionary];
  envs[@"PATH"] = @"/sbin:/usr/sbin:/bin:/usr/bin:/usr/local/bin";
  envs[@"KEYBASE_LABEL"] = _label;
  envs[@"KEYBASE_LOG_FORMAT"] = @"file";
  envs[@"KEYBASE_RUNTIME_DIR"] = _runtimeDir;
  return envs;
}

- (NSArray *)programArguments {
  NSMutableArray *pargs = [NSMutableArray array];
  [pargs addObject:_binPath];
  if (_args) {
    [pargs addObjectsFromArray:_args];
  }
  return pargs;
}

- (NSDictionary *)plistDictionary {
  NSArray *args = [self programArguments];
  NSDictionary *envs = [self envs];

  return @{
           @"Label": _label,
           @"EnvironmentVariables": envs,
           @"ProgramArguments": args,
           @"RunAtLoad": @YES,
           @"KeepAlive": @YES,
           @"StandardOutPath": _logPath,
           @"StandardErrorPath": _logPath,
           };
}

@end
