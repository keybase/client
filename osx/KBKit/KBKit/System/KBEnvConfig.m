//
//  KBEnvConfig.m
//  Keybase
//
//  Created by Gabriel on 5/27/15.
//  Copyright (c) 2015 Gabriel Handford. All rights reserved.
//

#import "KBEnvConfig.h"

#import "KBDefines.h"
#import "KBEnvironment.h"
#import "KBPath.h"

@interface KBEnvConfig ()
@property NSString *homeDir;
@property (getter=isDebugEnabled) BOOL debugEnabled;
@property NSString *mountDir;
@property NSString *title;
@property NSString *info;
@property KBRunMode runMode;
@property BOOL installDisabled;
@property KBInstallOptions installOptions;
@property NSTimeInterval installTimeout;
@property NSString *appPath;
@property NSString *sourcePath;
@end

@implementation KBEnvConfig

+ (instancetype)envConfigWithRunMode:(KBRunMode)runMode {
  return [[self.class alloc] initWithRunMode:runMode];
}

- (instancetype)initWithRunMode:(KBRunMode)runMode {
  if ((self = [super init])) {
    _runMode = runMode;

    // Read the mount point from the config file if possible.
    NSString *mountDir = [self defaultMountDir];
    NSData *data = [NSData dataWithContentsOfFile:[self dataPath:@"config.json" options:0]];
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

    switch (_runMode) {
      case KBRunModeProd: {
        self.title = @"Keybase.io";
        self.mountDir = mountDir;
        self.debugEnabled = YES;
        self.info = @"Uses keybase.io";
        break;
      }
      case KBRunModeStaging: {
        self.title = @"Staging";
        self.mountDir = mountDir;
        self.debugEnabled = YES;
        self.info = @"Uses staging server.";
        break;
      }
      case KBRunModeDevel: {
        self.title = @"Devel";
        self.mountDir = mountDir;
        self.debugEnabled = YES;
        self.info = @"Uses the local web server.";
        break;
      }
    }
  }
  return self;
}

+ (instancetype)envConfigWithRunModeString:(NSString *)runModeString installOptions:(KBInstallOptions)installOptions installTimeout:(NSTimeInterval)installTimeout appPath:(NSString *)appPath sourcePath:(NSString *)sourcePath {
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
  envConfig.installTimeout = installTimeout;
  envConfig.appPath = appPath;
  envConfig.sourcePath = sourcePath;
  return envConfig;
}

- (NSString *)appName {
  if (_runMode == KBRunModeProd) return @"Keybase";
  else return NSStringWithFormat(@"Keybase%@", NSStringFromKBRunMode(_runMode, NO));
}

- (NSString *)appNameWithDot {
  if (_runMode == KBRunModeProd) return @"Keybase";
  else return NSStringWithFormat(@"Keybase.%@", NSStringFromKBRunMode(_runMode, NO));
}

- (NSString *)defaultMountDir {
  // NOTE: if you change this default, you must also change the default
  // for darwin in the `GetMountDir` function of `libkb/env.go`.
  NSString *appName = [self appName];
  NSString *userName = NSUserName();
  NSString *mount = NSStringWithFormat(@"%@ (%@)", appName, userName);
  return [KBPath pathInDir:@"/Volumes" path:mount options:0];
}

- (NSString *)dataPath:(NSString *)filename options:(KBPathOptions)options {
  NSString *homeDir = self.homeDir;
  NSString *appPath = NSStringWithFormat(@"Library/Application Support/%@", [self appName]);
  if (filename) appPath = [appPath stringByAppendingPathComponent:filename];
  return [KBPath pathInDir:homeDir path:appPath options:options];
}

- (NSString *)runtimePath:(NSString *)filename options:(KBPathOptions)options {
  return [self cachePath:filename options:options];
}

- (NSString *)cachePath:(NSString *)filename options:(KBPathOptions)options {
  NSString *homeDir = self.homeDir;
  NSString *cachePath = NSStringWithFormat(@"Library/Caches/%@", [self appName]);
  if (filename) cachePath = [cachePath stringByAppendingPathComponent:filename];
  return [KBPath pathInDir:homeDir path:cachePath options:options];
}

- (NSString *)serviceBinPathWithPathOptions:(KBPathOptions)pathOptions servicePath:(NSString *)servicePath {
  if (!servicePath) return [self serviceBinName];
  return [KBPath pathInDir:servicePath path:[self serviceBinName] options:pathOptions];
}

- (NSString *)serviceBinName {
  switch(_runMode) {
    case KBRunModeDevel: return @"kbdev";
    case KBRunModeStaging: return @"kbstage";
    case KBRunModeProd: return @"keybase";
  }
}

- (NSString *)redirectorBinPathWithPathOptions:(KBPathOptions)pathOptions servicePath:(NSString *)servicePath {
  if (!servicePath) return [self redirectorBinName];
  return [KBPath pathInDir:servicePath path:[self redirectorBinName] options:pathOptions];
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
  NSString *homeDir = _homeDir ? _homeDir : @"~";
  return [KBPath path:homeDir options:0];
}

- (NSString *)sockFile {
  NSString *sockFile = [self runtimePath:@"keybased.sock" options:0];
  if ([sockFile length] > 103) {
    [NSException raise:NSInvalidArgumentException format:@"Sock path too long. It should be < 104 characters. %@", sockFile];
  }
  return sockFile;
}

- (BOOL)validate:(NSError **)error {
  NSString *homeDir = self.homeDir;
  if (homeDir && ![NSFileManager.defaultManager fileExistsAtPath:homeDir isDirectory:nil]) {
    if (error) *error = KBMakeError(KBErrorCodePathNotFound, @"%@ doesn't exist (homeDir)", homeDir);
    return NO;
  }
  NSString *sockFile = self.sockFile;
  if (sockFile && ![NSFileManager.defaultManager fileExistsAtPath:sockFile isDirectory:nil]) {
    if (error) *error = KBMakeError(KBErrorCodePathNotFound, @"%@ doesn't exist (sockFile)", sockFile);
    return NO;
  }
  NSString *mountDir = self.mountDir;
  if (mountDir && ![NSFileManager.defaultManager fileExistsAtPath:mountDir isDirectory:nil]) {
    if (error) *error = KBMakeError(KBErrorCodePathNotFound, @"%@ doesn't exist (mountDir)", mountDir);
    return NO;
  }
  return YES;
}

- (NSString *)launchdServiceLabel {
  if (_installDisabled) return nil;
  switch (_runMode) {
    case KBRunModeDevel: return @"keybase.service.devel";
    case KBRunModeStaging: return @"keybase.service.staging";
    case KBRunModeProd: return @"keybase.service";
  }
}

- (NSString *)launchdKBFSLabel {
  if (_installDisabled) return nil;
  switch (_runMode) {
    case KBRunModeDevel: return @"keybase.kbfs.devel";
    case KBRunModeStaging: return @"keybase.kbfs.staging";
    case KBRunModeProd: return @"keybase.kbfs";
  }
}

- (NSString *)launchdUpdaterLabel {
  if (_installDisabled) return nil;
  switch (_runMode) {
    case KBRunModeDevel: return @"keybase.updater.devel";
    case KBRunModeStaging: return @"keybase.updater.staging";
    case KBRunModeProd: return @"keybase.updater";
  }
}

- (BOOL)isInApplications:(NSString *)path {
  return [path gh_startsWith:@"/Applications/"];
}

@end

NSString *NSStringFromKBRunMode(KBRunMode runMode, BOOL isValue) {
  switch (runMode) {
    case KBRunModeDevel: return isValue ? @"devel" : @"Devel";
    case KBRunModeStaging: return isValue ? @"staging" : @"Staging";
    case KBRunModeProd: return isValue ? @"prod" : @"Prod";
  }
}
