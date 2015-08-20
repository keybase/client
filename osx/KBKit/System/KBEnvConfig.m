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

#define LOCALHOST (@"http://localhost:3000")
#define PRODHOST (@"https://api.keybase.io:443")

@interface KBEnvConfig ()
@property NSString *homeDir;
@property NSString *host;
@property (getter=isDebugEnabled) BOOL debugEnabled;
@property NSString *mountDir;
@property NSString *sockFile;
@property (getter=isLaunchdEnabled) BOOL launchdEnabled;
@property NSString *launchdLabelService;
@property NSString *launchdLabelKBFS;
@property NSString *title;
@property NSString *info;
@property NSImage *image;
@property (getter=isInstallEnabled) BOOL installEnabled;
@property KBEnvType envType;
@end

@implementation KBEnvConfig

+ (instancetype)envType:(KBEnvType)envType {
  return [[self.class alloc] initWithEnvType:envType];
}

- (instancetype)initWithEnvType:(KBEnvType)envType {
  if ((self = [super init])) {
    _envType = envType;
    switch (_envType) {
      case KBEnvTypeProd: {
        self.title = @"Keybase.io";
        self.host = PRODHOST;
        self.mountDir = [KBPath path:@"~/Keybase" options:0];
        self.debugEnabled = YES;
        self.info = @"Uses keybase.io";
        self.image = [NSImage imageNamed:NSImageNameNetwork];
        self.launchdEnabled = YES;
        self.installEnabled = YES;
        self.launchdLabelService = @"keybase.Service";
        self.launchdLabelKBFS = @"keybase.KBFS";
        break;
      }
      case KBEnvTypeDevel: {
        self.title = @"Local";
        self.host = LOCALHOST;
        self.mountDir = [KBPath path:@"~/Keybase.local" options:0];
        self.debugEnabled = YES;
        self.info = @"Uses the localhost web server";
        self.image = [NSImage imageNamed:NSImageNameComputer];
        self.launchdEnabled = YES;
        self.launchdLabelService = @"keybase.Service.localhost";
        self.launchdLabelKBFS = @"keybase.KBFS.localhost";
        self.installEnabled = YES;
        break;
      }
      case KBEnvTypeBrew: {
        self.title = @"Homebrew";
        self.mountDir = [KBPath path:@"~/Keybase.brew" options:0];
        self.debugEnabled = YES;
        self.info = @"Uses homebrew install";
        self.image = [KBIcons imageForIcon:KBIconExecutableBinary];
        self.launchdEnabled = NO;
        self.installEnabled = NO;
        break;
      }
      case KBEnvTypeCustom:
        [NSException raise:NSInvalidArgumentException format:@"For custom env, use customEnvWithHomeDir:..."];
        break;
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

  if (!mountDir) mountDir = [KBPath path:@"~/Keybase.dev" options:0];

  return [KBEnvConfig customEnvWithHomeDir:homeDir sockFile:nil mountDir:mountDir];
}

- (void)saveToUserDefaults:(NSUserDefaults *)userDefaults {
  [userDefaults setObject:[KBPath path:self.homeDir options:0] forKey:@"HomeDir"];
  [userDefaults setObject:[KBPath path:self.mountDir options:0] forKey:@"MountDir"];
  [userDefaults synchronize];
}

- (NSString *)appName {
    switch (_envType) {
      case KBEnvTypeProd: return @"Keybase";
      default: return @"KeybaseDev";
    }
}

- (NSString *)appPath:(NSString *)filename options:(KBPathOptions)options {
  NSString *homeDir = self.homeDir;
  NSString *appPath = NSStringWithFormat(@"Library/Application Support/%@", [self appName]);
  if (filename) appPath = [appPath stringByAppendingPathComponent:filename];
  return [KBPath pathInDir:homeDir path:appPath options:options];
}

- (NSString *)cachePath:(NSString *)filename options:(KBPathOptions)options {
  NSString *homeDir = self.homeDir;
  NSString *cachePath = NSStringWithFormat(@"Library/Caches/%@", [self appName]);
  if (filename) cachePath = [cachePath stringByAppendingPathComponent:filename];
  return [KBPath pathInDir:homeDir path:cachePath options:options];
}

- (NSString *)homeDir {
  NSString *homeDir = _homeDir ? _homeDir : @"~";
  return [KBPath path:homeDir options:0];
}

- (NSString *)sockFile {
  NSString *sockFile = [self appPath:_sockFile ? _sockFile : @"keybased.sock" options:0];
  if ([sockFile length] > 103) {
    [NSException raise:NSInvalidArgumentException format:@"Sock path too long. It should be < 104 characters. %@", sockFile];
  }
  return sockFile;
}

- (BOOL)isHomeDirSet { return !!_homeDir; }
- (BOOL)isSockFileSet { return !!_sockFile; }

+ (instancetype)customEnvWithHomeDir:(NSString *)homeDir sockFile:(NSString *)sockFile mountDir:(NSString *)mountDir {
  KBEnvConfig *envConfig = [[KBEnvConfig alloc] init];
  envConfig.envType = KBEnvTypeCustom;
  envConfig.title = @"Custom";
  envConfig.homeDir = [KBPath path:homeDir options:0];
  envConfig.sockFile = [KBPath path:sockFile options:0];
  envConfig.mountDir = [KBPath path:mountDir options:0];
  envConfig.info = @"For development";
  envConfig.image = [NSImage imageNamed:NSImageNameAdvanced];
  envConfig.launchdEnabled = NO;
  envConfig.installEnabled = NO;
  envConfig.debugEnabled = YES;
  return envConfig;
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

@end