//
//  KBServiceConfig.m
//  Keybase
//
//  Created by Gabriel on 8/29/15.
//  Copyright (c) 2015 Keybase. All rights reserved.
//

#import "KBServiceConfig.h"

#import <ObjectiveSugar/ObjectiveSugar.h>

@interface KBServiceConfig ()
@property KBEnvConfig *config;
@property NSString *versionPath;
@end

@implementation KBServiceConfig

- (instancetype)initWithConfig:(KBEnvConfig *)config {
  if ((self = [self init])) {
    _config = config;
    _versionPath = [config cachePath:@"service.version" options:0];
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

  if (_config.host) {
    [pargs addObjectsFromArray:@[@"-s", _config.host]];
  }

  if (_config.debugEnabled) {
    [pargs addObject:@"-d"];
  }

  if (_config.isSockFileSet) {
    [pargs addObject:NSStringWithFormat(@"--socket-file=%@", [KBPath path:_config.sockFile options:pathOptions])];
  }

  if (args) {
    [pargs addObjectsFromArray:args];
  }

  [pargs addObject:@"service"];

  return pargs;
}

- (NSDictionary *)launchdPlistDictionary {
  if (!_config.launchdLabelService) return nil;

  NSArray *args = [self programArgumentsWithPathOptions:0 useBundle:YES args:@[@"--log-format=file"]];

  return @{
           @"Label": _config.launchdLabelService,
           @"ProgramArguments": args,
           @"RunAtLoad": @YES,
           @"KeepAlive": @YES,
           @"WorkingDirectory": [_config appPath:nil options:0],
           @"StandardOutPath": [_config logFile:_config.launchdLabelService],
           @"StandardErrorPath": [_config logFile:_config.launchdLabelService],
           };
}

- (NSString *)commandLineWithPathOptions:(KBPathOptions)pathOptions {
  return [[self programArgumentsWithPathOptions:pathOptions useBundle:NO args:nil] join:@" "];
}

@end
