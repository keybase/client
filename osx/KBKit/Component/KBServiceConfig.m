//
//  KBServiceConfig.m
//  Keybase
//
//  Created by Gabriel on 8/29/15.
//  Copyright (c) 2015 Keybase. All rights reserved.
//

#import "KBServiceConfig.h"

#import <ObjectiveSugar/ObjectiveSugar.h>
#import <GHKit/GHKit.h>

@interface KBServiceConfig ()
@property KBEnvConfig *config;
@property NSString *versionPath;
@end

@implementation KBServiceConfig

- (instancetype)initWithConfig:(KBEnvConfig *)config {
  if ((self = [self init])) {
    _config = config;

    _versionPath = [config runtimePath:@"service.version" options:0];
  }
  return self;
}

- (NSArray *)programArgumentsWithPathOptions:(KBPathOptions)pathOptions useBundle:(BOOL)useBundle args:(NSArray *)args {
  NSMutableArray *pargs = [NSMutableArray array];
  if (useBundle) {
    [pargs addObject:[KBPath pathInDir:_config.bundle.sharedSupportPath path:@"bin/keybase" options:pathOptions]];
  } else {
    [pargs addObjectsFromArray:@[@"./keybase"]];
  }
  if (_config.isHomeDirSet) {
    [pargs addObjectsFromArray:@[@"-H", [KBPath path:_config.homeDir options:pathOptions]]];
  }

  [pargs addObject:NSStringWithFormat(@"--run-mode=%@", NSStringFromKBRunMode(_config.runMode, YES))];

  if (_config.debugEnabled) {
    [pargs addObject:@"-d"];
  }

  if (args) {
    [pargs addObjectsFromArray:args];
  }

  [pargs addObject:@"service"];

  return pargs;
}

- (NSDictionary *)launchdPlistDictionary:(NSString *)label {
  NSParameterAssert(label);

  NSMutableArray *pargs = [NSMutableArray array];
  [pargs addObject:NSStringWithFormat(@"--label=%@", label)];
  [pargs addObject:@"--log-format=file"];

  NSArray *args = [self programArgumentsWithPathOptions:0 useBundle:YES args:pargs];
  NSString *logFile = [_config logFile:label];
  return @{
           @"Label": label,
           @"ProgramArguments": args,
           @"RunAtLoad": @YES,
           @"KeepAlive": @YES,
           @"WorkingDirectory": [_config cachePath:nil options:0],
           @"StandardOutPath": logFile,
           @"StandardErrorPath": logFile,
           };
}

- (NSString *)commandLineWithPathOptions:(KBPathOptions)pathOptions {
  return [[self programArgumentsWithPathOptions:pathOptions useBundle:NO args:nil] join:@" "];
}

@end
