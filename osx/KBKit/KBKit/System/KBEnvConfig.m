//
//  KBEnvConfig.m
//  Keybase
//
//  Created by Gabriel on 5/27/15.
//  Copyright (c) 2015 Gabriel Handford. All rights reserved.
//

#import "KBEnvConfig.h"

#import "KBDefines.h"
#import "KBPath.h"

@interface KBEnvConfig ()
@property NSString *mountDir;
@property KBRunMode runMode;
@property KBInstallOptions installOptions;
@property NSString *appPath;
@property NSString *sourcePath;
@end

static NSString *NSStringFromKBRunMode(KBRunMode runMode) {
  switch (runMode) {
    case KBRunModeDevel: return @"Devel";
    case KBRunModeStaging: return @"Staging";
    case KBRunModeProd: return @"Prod";
  }
}

@implementation KBEnvConfig

+ (instancetype)envConfigWithRunMode:(KBRunMode)runMode {
  return [[self.class alloc] initWithRunMode:runMode];
}

- (instancetype)initWithRunMode:(KBRunMode)runMode {
  if ((self = [super init])) {
    _runMode = runMode;

    // Read the mount point from the config file if possible.
    NSString *mountDir = [self defaultMountDir];
    NSData *data = [NSData dataWithContentsOfFile:[self dataPath:@"config.json"]];
    if (data) {
      NSError *err = nil;
      NSDictionary *appConfig = [NSJSONSerialization JSONObjectWithData:data options:kNilOptions error:&err];
      if (!err) {
        id obj = [appConfig valueForKeyPath:@"mountdir"];
        if (obj) {
          mountDir = (NSString *)obj;
        }
      }
    }

    self.mountDir = mountDir;
  }
  return self;
}

+ (instancetype)envConfigWithRunModeString:(NSString *)runModeString installOptions:(KBInstallOptions)installOptions appPath:(NSString *)appPath sourcePath:(NSString *)sourcePath {
  KBEnvConfig *envConfig;
  if ([runModeString isEqualToString:@"prod"]) {
    envConfig = [KBEnvConfig envConfigWithRunMode:KBRunModeProd];
  } else if ([runModeString isEqualToString:@"staging"]) {
    envConfig = [KBEnvConfig envConfigWithRunMode:KBRunModeStaging];
  } else if ([runModeString isEqualToString:@"devel"]) {
    envConfig = [KBEnvConfig envConfigWithRunMode:KBRunModeDevel];
  } else {
    return nil;
  }
  envConfig.installOptions = installOptions;
  envConfig.appPath = appPath;
  envConfig.sourcePath = sourcePath;
  return envConfig;
}

- (NSString *)appName {
  if (_runMode == KBRunModeProd) return @"Keybase";
  else return NSStringWithFormat(@"Keybase%@", NSStringFromKBRunMode(_runMode));
}

- (NSString *)appNameWithDot {
  if (_runMode == KBRunModeProd) return @"Keybase";
  else return NSStringWithFormat(@"Keybase.%@", NSStringFromKBRunMode(_runMode));
}

- (NSString *)defaultMountDir {
  // NOTE: if you change this default, you must also change the default
  // for darwin in the `GetMountDir` function of `libkb/env.go`.
  NSString *appName = [self appName];
  NSString *userName = NSUserName();
  NSString *mount = NSStringWithFormat(@"%@ (%@)", appName, userName);
  return [KBPath pathInDir:@"/Volumes" path:mount];
}

- (NSString *)dataPath:(NSString *)filename {
  NSString *homeDir = self.homeDir;
  NSString *appPath = NSStringWithFormat(@"Library/Application Support/%@", [self appName]);
  if (filename) appPath = [appPath stringByAppendingPathComponent:filename];
  return [KBPath pathInDir:homeDir path:appPath];
}

- (NSString *)serviceBinPath:(NSString *)servicePath {
  if (!servicePath) return [self serviceBinName];
  return [KBPath pathInDir:servicePath path:[self serviceBinName]];
}

- (NSString *)serviceBinName {
  switch(_runMode) {
    case KBRunModeDevel: return @"kbdev";
    case KBRunModeStaging: return @"kbstage";
    case KBRunModeProd: return @"keybase";
  }
}

- (NSString *)redirectorBinPath:(NSString *)servicePath {
  if (!servicePath) return [self redirectorBinName];
  return [KBPath pathInDir:servicePath path:[self redirectorBinName]];
}

- (NSString *)gitRemoteHelperName {
  return @"git-remote-keybase";
}

- (NSString *)redirectorBinName {
  return @"keybase-redirector";
}

- (NSString *)redirectorMount {
  switch(_runMode) {
    case KBRunModeDevel: return @"/keybase.devel";
    case KBRunModeStaging: return @"/keybase.staging";
    case KBRunModeProd: return @"/keybase";
  }
}

- (NSString *)volumesRedirectorMount {
  switch(_runMode) {
    case KBRunModeDevel: return @"/Volumes/KeybaseDevel";
    case KBRunModeStaging: return @"/Volumes/KeybaseStaging";
    case KBRunModeProd: return @"/Volumes/Keybase";
  }
}

- (BOOL)redirectorDisabled {
  NSString *rootConfigPath = NSStringWithFormat(@"/etc/%@/config.json", [self appNameWithDot]);
  NSData *data = [NSData dataWithContentsOfFile:rootConfigPath];
  if (data) {
    NSError *err = nil;
    NSDictionary *appConfig = [NSJSONSerialization JSONObjectWithData:data options:kNilOptions error:&err];
    if (!err) {
      id obj = [appConfig valueForKeyPath:@"disable-root-redirector"];
      if (obj) {
        NSNumber *val = (NSNumber *)obj;
        return [val boolValue];
      }
    }
  }
  return NO;
}

- (NSString *)homeDir {
  return [KBPath path:@"~"];
}

- (BOOL)isInApplications:(NSString *)path {
  return [path gh_startsWith:@"/Applications/"];
}

@end
