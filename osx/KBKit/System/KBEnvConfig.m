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
#import <KBAppKit/KBAppKit.h>

@interface KBEnvConfig ()
@property NSString *homeDir;
@property NSString *host;
@property (getter=isDebugEnabled) BOOL debugEnabled;
@property (getter=isDevelMode) BOOL develMode;
@property NSString *mountDir;
@property NSString *sockFile;
@property NSString *identifier;
@property (getter=isLaunchdEnabled) BOOL launchdEnabled;
@property NSString *launchdLabelService;
@property NSString *launchdLabelKBFS;
@property NSString *title;
@property NSString *info;
@property NSImage *image;
@property (getter=isInstallEnabled) BOOL installEnabled;
@property NSString *configFile; // Deprecated, will remove soon
@end

@implementation KBEnvConfig

- (instancetype)initWithEnv:(KBEnv)env {
  if ((self = [super init])) {
    switch (env) {
      case KBEnvProd: {
        self.title = @"Keybase.io";
        self.identifier = @"live";
        self.host = @"https://api.keybase.io:443";
        self.mountDir = [KBPath path:@"~/Keybase" options:0];
        self.debugEnabled = YES;
        self.info = @"Uses keybase.io";
        self.image = [NSImage imageNamed:NSImageNameNetwork];
        self.launchdEnabled = YES;
        self.installEnabled = YES;
        break;
      }
      case KBEnvDevel: {
        self.title = @"Local";
        self.identifier = @"localhost";
        self.host = @"http://localhost:3000";
        self.develMode = YES;
        self.mountDir = [KBPath path:@"~/Keybase.local" options:0];
        self.debugEnabled = YES;
        self.info = @"Uses the localhost web server";
        self.image = [NSImage imageNamed:NSImageNameComputer];
        self.launchdEnabled = YES;
        self.installEnabled = YES;
        break;
      }
      case KBEnvBrew: {
        self.title = @"Homebrew";
        self.identifier = @"brew";
        self.mountDir = [KBPath path:@"~/Keybase.brew" options:0];
        self.debugEnabled = YES;
        self.info = @"Uses homebrew install";
        self.image = [KBIcons imageForIcon:KBIconExecutableBinary];
        self.launchdEnabled = NO;
        self.installEnabled = NO;
        break;
      }
    }

    if (self.isLaunchdEnabled) {
      self.launchdLabelService = NSStringWithFormat(@"keybase.Service.%@", self.identifier);
      self.launchdLabelKBFS = NSStringWithFormat(@"keybase.KBFS.%@", self.identifier);
    }
  }
  return self;
}

+ (NSString *)groupContainer:(NSString *)path {
  NSString *dir = [[NSFileManager defaultManager] containerURLForSecurityApplicationGroupIdentifier:KBAppGroupId].path;
  return [KBPath pathInDir:dir path:path options:0];
}

+ (instancetype)loadFromUserDefaults:(NSUserDefaults *)userDefaults {
  NSString *homeDir = [userDefaults stringForKey:@"HomeDir"];
  NSString *mountDir = [userDefaults stringForKey:@"MountDir"];
  BOOL develMode = [userDefaults boolForKey:@"Devel"];

  //if (!homeDir) homeDir = [KBEnvConfig groupContainer:@"dev"];
  if (!mountDir) mountDir = [KBPath path:@"~/Keybase.dev" options:0];

  return [[KBEnvConfig alloc] initWithHomeDir:homeDir sockFile:nil mountDir:mountDir develMode:develMode];
}

- (void)saveToUserDefaults:(NSUserDefaults *)userDefaults {
  [userDefaults setObject:[KBPath path:self.homeDir options:0] forKey:@"HomeDir"];
  [userDefaults setObject:[KBPath path:self.mountDir options:0] forKey:@"MountDir"];
  [userDefaults setBool:self.isDevelMode forKey:@"Devel"];
  [userDefaults synchronize];
}

- (NSString *)appName {
  return self.isDevelMode ? @"KeybaseDev" : @"Keybase";
}

- (NSString *)appPath:(NSString *)filename options:(KBPathOptions)options {
  NSString *homeDir = _homeDir ? _homeDir : @"~";
  NSString *appPath = NSStringWithFormat(@"Library/Application Support/%@", [self appName]);
  if (filename) appPath = [appPath stringByAppendingPathComponent:filename];
  return [KBPath pathInDir:homeDir path:appPath options:options];
}

- (NSString *)cachePath:(NSString *)filename options:(KBPathOptions)options {
  NSString *homeDir = _homeDir ? _homeDir : @"~";
  NSString *cachePath = NSStringWithFormat(@"Library/Caches/%@", [self appName]);
  if (filename) cachePath = [cachePath stringByAppendingPathComponent:filename];
  return [KBPath pathInDir:homeDir path:cachePath options:options];
}

- (NSString *)configFile {
  return [self appPath:_configFile ? _configFile : @"config.json" options:0];
}

- (NSString *)sockFile {
  NSString *sockFile = [self appPath:_sockFile ? _sockFile : @"keybased.sock" options:0];
  if ([sockFile length] > 103) {
    [NSException raise:NSInvalidArgumentException format:@"Sock path too long. It should be < 104 characters. %@", sockFile];
  }
  return sockFile;
}

+ (instancetype)env:(KBEnv)env {
  return [[self.class alloc] initWithEnv:env];
}

- (instancetype)initWithHomeDir:(NSString *)homeDir sockFile:(NSString *)sockFile mountDir:(NSString *)mountDir develMode:(BOOL)develMode {
  if ((self = [super init])) {
    self.identifier = @"custom";
    self.title = @"Custom";
    self.homeDir = [KBPath path:homeDir options:0];
    self.sockFile = [KBPath path:sockFile options:0];
    self.mountDir = [KBPath path:mountDir options:0];
    self.info = @"For development";
    self.image = [NSImage imageNamed:NSImageNameAdvanced];
    self.launchdEnabled = NO;
    self.installEnabled = NO;
    self.debugEnabled = YES;
    self.develMode = develMode;
  }
  return self;
}

- (NSString *)logFile:(NSString *)label {
  NSString *logDir = [KBPath path:@"~/Library/Logs" options:0];
  // Be careful of logging. I've seen launchd create these as root, and cause the service to fail.
  return NSStringWithFormat(@"%@/%@.log", logDir, label);
}

- (NSBundle *)bundle {
#ifdef DEBUG
  return [NSBundle bundleWithPath:@"/Applications/Keybase.app"];
#else
  return NSBundle.mainBundle;
#endif
}

- (BOOL)validate:(NSError **)error {
  if (_homeDir && ![NSFileManager.defaultManager fileExistsAtPath:[KBPath path:_homeDir options:0] isDirectory:nil]) {
    if (error) *error = KBMakeError(KBErrorCodePathNotFound, @"%@ doesn't exist (homeDir)", _homeDir);
    return NO;
  }
  if (_sockFile && ![NSFileManager.defaultManager fileExistsAtPath:[KBPath path:_sockFile options:0] isDirectory:nil]) {
    if (error) *error = KBMakeError(KBErrorCodePathNotFound, @"%@ doesn't exist (sockFile)", _sockFile);
    return NO;
  }
  if (_mountDir && ![NSFileManager.defaultManager fileExistsAtPath:[KBPath path:_mountDir options:0] isDirectory:nil]) {
    if (error) *error = KBMakeError(KBErrorCodePathNotFound, @"%@ doesn't exist (mountDir)", _mountDir);
    return NO;
  }
  return YES;
}

@end