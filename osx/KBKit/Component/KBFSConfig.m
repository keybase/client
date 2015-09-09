//
//  KBFSConfig.m
//  Keybase
//
//  Created by Gabriel on 8/29/15.
//  Copyright (c) 2015 Keybase. All rights reserved.
//

#import "KBFSConfig.h"

#import <ObjectiveSugar/ObjectiveSugar.h>

@interface KBFSConfig ()
@property KBEnvConfig *config;
@property NSString *versionPath;
@end

@implementation KBFSConfig

- (instancetype)initWithConfig:(KBEnvConfig *)config {
  if ((self = [self init])) {
    _config = config;
    _versionPath = [config runtimePath:@"kbfs.version" options:0];
  }
  return self;
}

- (NSDictionary *)envsWithPathOptions:(KBPathOptions)pathOptions {
  NSMutableDictionary *envs = [NSMutableDictionary dictionary];
  //envs[@"PATH"] = @"/sbin:/usr/sbin:/Library/Filesystems/osxfusefs.fs/Support"; // For umount, diskutil, mount_osxfusefs
  envs[@"KEYBASE_SOCKET_FILE"] = [KBPath path:_config.sockFile options:pathOptions];
  envs[@"KEYBASE_CONFIG_FILE"] = [KBPath path:[_config appPath:@"config.json" options:0] options:pathOptions];
  return envs;
}

- (NSArray *)programArgumentsWithPathOptions:(KBPathOptions)pathOptions useBundle:(BOOL)useBundle args:(NSArray *)args {
  NSMutableArray *pargs = [NSMutableArray array];

  if (useBundle) {
    [pargs addObject:NSStringWithFormat(@"%@/bin/kbfsfuse", _config.bundle.sharedSupportPath)];
  } else {
    [pargs addObject:@"./kbfsfuse"];
  }

  if (_config.debugEnabled) {
    [pargs addObject:@"-debug"];
  }

  [pargs addObject:@"-client"];

  [pargs addObject:NSStringWithFormat(@"-server-root=%@", [_config appPath:nil options:pathOptions])];

  [pargs addObject:NSStringWithFormat(@"-version-file=%@", [KBPath path:_versionPath options:pathOptions])];

  [pargs addObject:@"-mount-type=force"];

  if (args) {
    [pargs addObjectsFromArray:args];
  }

  if (_config.mountDir) [pargs addObject:[KBPath path:_config.mountDir options:pathOptions]];

  return pargs;
}

- (NSDictionary *)launchdPlistDictionary:(NSString *)label {
  NSParameterAssert(label);

  NSArray *args = [self programArgumentsWithPathOptions:0 useBundle:YES args:nil];
  NSDictionary *envs = [self envsWithPathOptions:0];
  return @{
           @"Label": label,
           @"EnvironmentVariables": envs,
           @"ProgramArguments": args,
           @"RunAtLoad": @YES,
           @"KeepAlive": @YES,
           @"WorkingDirectory": [_config appPath:nil options:0],
           @"StandardOutPath": [_config logFile:label],
           @"StandardErrorPath": [_config logFile:label],
           };
}

- (NSString *)commandLineWithPathOptions:(KBPathOptions)pathOptions {
  NSString *envs = [[[self envsWithPathOptions:pathOptions] map:^(id key, id value) { return NSStringWithFormat(@"%@=%@", key, value); }] join:@" "];
  NSString *pargs = [[self programArgumentsWithPathOptions:pathOptions useBundle:NO args:nil] join:@" "];
  return NSStringWithFormat(@"%@ %@", envs, pargs);
}

@end
