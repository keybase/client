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
#import <Tikppa/Tikppa.h>

@interface KBEnvConfig ()
@property NSString *homeDir;
@property (getter=isDebugEnabled) BOOL debugEnabled;
@property NSString *mountDir;
@property NSString *title;
@property NSString *info;
@property NSImage *image;
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
    switch (_runMode) {
      case KBRunModeProd: {
        self.title = @"Keybase.io";
        self.mountDir = [KBPath path:@"/keybase" options:0];
        self.debugEnabled = YES;
        self.info = @"Uses keybase.io";
        self.image = [NSImage imageNamed:NSImageNameNetwork];
        break;
      }
      case KBRunModeStaging: {
        self.title = @"Staging";
        self.mountDir = [KBPath path:@"/keybase.staging" options:0];
        self.debugEnabled = YES;
        self.info = @"Uses staging server.";
        self.image = [NSImage imageNamed:NSImageNameNetwork];
        break;
      }
      case KBRunModeDevel: {
        self.title = @"Devel";
        self.mountDir = [KBPath path:@"/keybase.devel" options:0];
        self.debugEnabled = YES;
        self.info = @"Uses the local web server.";
        self.image = [NSImage imageNamed:NSImageNameComputer];
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

+ (NSString *)groupContainer:(NSString *)path {
  NSString *dir = [[NSFileManager defaultManager] containerURLForSecurityApplicationGroupIdentifier:KBAppGroupId].path;
  return [KBPath pathInDir:dir path:path options:0];
}

+ (instancetype)envConfigFromUserDefaults:(NSUserDefaults *)userDefaults {
  NSString *homeDir = [userDefaults stringForKey:@"HomeDir"];
  NSString *mountDir = [userDefaults stringForKey:@"MountDir"];

  if (!mountDir) mountDir = [KBPath path:@"~/Keybase.dev" options:0];

  return [KBEnvConfig envConfigWithHomeDir:homeDir mountDir:mountDir runMode:KBRunModeDevel];
}

- (void)saveToUserDefaults:(NSUserDefaults *)userDefaults {
  [userDefaults setObject:[KBPath path:self.homeDir options:0] forKey:@"HomeDir"];
  [userDefaults setObject:[KBPath path:self.mountDir options:0] forKey:@"MountDir"];
  [userDefaults synchronize];
}

- (NSString *)appName {
  if (_runMode == KBRunModeProd) return @"Keybase";
  else return NSStringWithFormat(@"Keybase%@", NSStringFromKBRunMode(_runMode, NO));
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

- (NSString *)kbfsBinPathWithPathOptions:(KBPathOptions)pathOptions servicePath:(NSString *)servicePath {
  if (!servicePath) return [self serviceBinName];
  return [KBPath pathInDir:servicePath path:[self kbfsBinName] options:pathOptions];
}

- (NSString *)kbfsBinName {
  switch(_runMode) {
    case KBRunModeDevel: return @"kbfsdev";
    case KBRunModeStaging: return @"kbfsstage";
    case KBRunModeProd: return @"kbfs";
  }
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

- (BOOL)isHomeDirSet { return !!_homeDir; }

+ (instancetype)envConfigWithHomeDir:(NSString *)homeDir mountDir:(NSString *)mountDir runMode:(KBRunMode)runMode {
  KBEnvConfig *envConfig = [[KBEnvConfig alloc] init];
  envConfig.runMode = runMode;
  envConfig.title = @"Custom";
  envConfig.homeDir = [KBPath path:homeDir options:0];
  envConfig.mountDir = [KBPath path:mountDir options:0];
  envConfig.info = @"For development";
  envConfig.image = [NSImage imageNamed:NSImageNameAdvanced];
  envConfig.debugEnabled = YES;
  envConfig.installDisabled = YES;
  return envConfig;
}

- (NSString *)logFile:(NSString *)label {
  NSString *logDir = [KBPath path:@"~/Library/Logs" options:0];
  // Be careful of logging. I've seen launchd create these as root, and cause the service to fail.
  return NSStringWithFormat(@"%@/%@.log", logDir, label);
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

- (BOOL)isInUserApplications:(NSString *)path {
  return [path gh_startsWith:NSStringWithFormat(@"%@/Applications/", NSHomeDirectory())];
}

@end

NSString *NSStringFromKBRunMode(KBRunMode runMode, BOOL isValue) {
  switch (runMode) {
    case KBRunModeDevel: return isValue ? @"devel" : @"Devel";
    case KBRunModeStaging: return isValue ? @"staging" : @"Staging";
    case KBRunModeProd: return isValue ? @"prod" : @"Prod";
  }
}
