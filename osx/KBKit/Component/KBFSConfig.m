//
//  KBFSConfig.m
//  Keybase
//
//  Created by Gabriel on 8/29/15.
//  Copyright (c) 2015 Keybase. All rights reserved.
//

#import "KBFSConfig.h"

#import <ObjectiveSugar/ObjectiveSugar.h>
#import "KBLaunchdPlist.h"

@interface KBFSConfig ()
@property KBEnvConfig *config;
@end

@implementation KBFSConfig

- (instancetype)initWithConfig:(KBEnvConfig *)config {
  if ((self = [self init])) {
    _config = config;
  }
  return self;
}

- (NSString *)binPathWithPathOptions:(KBPathOptions)pathOptions useBundle:(BOOL)useBundle {
  if (useBundle) {
    return [KBPath pathInDir:_config.bundle.sharedSupportPath path:@"bin/kbfsfuse" options:pathOptions];
  } else {
    return @"./kbfsfuse";
  }
}

- (NSArray *)programArgumentsWithPathOptions:(KBPathOptions)pathOptions useBundle:(BOOL)useBundle args:(NSArray *)args {
  NSMutableArray *pargs = [NSMutableArray array];
  [pargs addObject:[self binPathWithPathOptions:pathOptions useBundle:useBundle]];

  if (_config.debugEnabled) {
    [pargs addObject:@"-debug"];
  }

  [pargs addObject:@"-client"];

  [pargs addObject:NSStringWithFormat(@"-server-root=%@", [_config appPath:nil options:pathOptions])];

  [pargs addObject:NSStringWithFormat(@"-runtime-dir=%@", [_config runtimePath:nil options:pathOptions])];

  [pargs addObject:@"-mount-type=force"];

  if (args) {
    [pargs addObjectsFromArray:args];
  }

  if (_config.mountDir) [pargs addObject:[KBPath path:_config.mountDir options:pathOptions]];

  return pargs;
}

- (NSDictionary *)launchdPlistDictionary:(NSString *)label {
  NSParameterAssert(label);
  NSString *binPath = [self binPathWithPathOptions:0 useBundle:YES];
  NSString *runtimeDir = [_config runtimePath:nil options:0];
  NSString *logPath = [_config logFile:label];
  NSArray *args = @[@"-mount-type=force"];
  KBLaunchdPlist *plist = [[KBLaunchdPlist alloc] initWithLabel:label binPath:binPath runtimeDir:runtimeDir logPath:logPath args:args];
  return [plist plistDictionary];
}

- (NSString *)commandLineWithPathOptions:(KBPathOptions)pathOptions {
  NSMutableDictionary *envs = [NSMutableDictionary dictionary];
  envs[@"KEYBASE_SOCKET_FILE"] = [KBPath path:_config.sockFile options:pathOptions];
  envs[@"KEYBASE_CONFIG_FILE"] = [KBPath path:[_config appPath:@"config.json" options:0] options:pathOptions];
  NSString *envsStr = [[envs map:^(id key, id value) { return NSStringWithFormat(@"%@=%@", key, value); }] join:@" "];

  NSString *pargs = [[self programArgumentsWithPathOptions:pathOptions useBundle:NO args:nil] join:@" "];
  return NSStringWithFormat(@"%@ %@", envsStr, pargs);
}

@end
