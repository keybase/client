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
#import "KBLaunchdPlist.h"

@interface KBServiceConfig ()
@property KBEnvConfig *config;
@end

@implementation KBServiceConfig

- (instancetype)initWithConfig:(KBEnvConfig *)config {
  if ((self = [self init])) {
    _config = config;
  }
  return self;
}

- (NSArray *)programArgumentsWithPathOptions:(KBPathOptions)pathOptions useBundle:(BOOL)useBundle args:(NSArray *)args {
  NSMutableArray *pargs = [NSMutableArray array];
  [pargs addObject:[_config serviceBinPathWithPathOptions:pathOptions useBundle:useBundle]];

  NSString *defaultHomeDir = NSProcessInfo.processInfo.environment[@"HOME"];
  if (_config.isHomeDirSet && ![_config.homeDir isEqual:defaultHomeDir]) {
    [pargs addObjectsFromArray:@[@"-H", [KBPath path:_config.homeDir options:pathOptions]]];
  }

  if (_config.runMode != KBRunModeDevel) {
    [pargs addObject:NSStringWithFormat(@"--run-mode=%@", NSStringFromKBRunMode(_config.runMode, YES))];
  }

  if (_config.debugEnabled) {
    [pargs addObject:@"-d"];
  }

  if (args) {
    [pargs addObjectsFromArray:args];
  }

  [pargs addObject:@"service"];

  return pargs;
}

- (NSString *)commandLineWithPathOptions:(KBPathOptions)pathOptions {
  return [[self programArgumentsWithPathOptions:pathOptions useBundle:NO args:nil] join:@" "];
}

- (NSDictionary *)launchdPlistDictionary:(NSString *)label {
  NSParameterAssert(label);
  NSString *binPath = [_config serviceBinPathWithPathOptions:0 useBundle:YES];
  NSString *runtimeDir = [_config runtimePath:nil options:0];
  NSString *logPath = [_config logFile:label];
  NSArray *args = @[@"service"];
  KBLaunchdPlist *plist = [[KBLaunchdPlist alloc] initWithLabel:label binPath:binPath runtimeDir:runtimeDir logPath:logPath args:args];
  return [plist plistDictionary];
}

@end
