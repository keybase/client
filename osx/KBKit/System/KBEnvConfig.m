//
//  KBEnvConfig.m
//  Keybase
//
//  Created by Gabriel on 5/27/15.
//  Copyright (c) 2015 Gabriel Handford. All rights reserved.
//

#import "KBEnvConfig.h"

#import "KBDefines.h"

#import <ObjectiveSugar/ObjectiveSugar.h>
#import <AppKit/AppKit.h>
#import <GHODictionary/GHODictionary.h>
#import <CocoaLumberjack/CocoaLumberjack.h>

@interface KBEnvConfig ()
@property NSString *homeDir;
@property NSString *host;
@property (getter=isDebugEnabled) BOOL debugEnabled;
@property (getter=isDebugEnabled) BOOL develMode;
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
        self.identifier = @"kb";
        self.homeDir = KBPath(@"~", NO, NO); // [KBEnvConfig groupContainer:self.identifier];
        self.host = @"https://api.keybase.io:443";
        self.mountDir = KBPath(@"~/Keybase", NO, NO);
        self.debugEnabled = YES;
        self.info = @"Uses api.keybase.io.";
        self.image = [NSImage imageNamed:NSImageNameNetwork];
        self.launchdEnabled = YES;
        self.installEnabled = YES;
        break;
      }
      case KBEnvDevel: {
        self.title = @"Local";
        self.identifier = @"localhost";
        self.homeDir = KBPath(@"~", NO, NO); //[KBEnvConfig groupContainer:self.identifier];
        self.host = @"http://localhost:3000";
        self.develMode = YES;
        self.mountDir = KBPath(@"~/Keybase.local", NO, NO);
        self.debugEnabled = YES;
        self.info = @"Uses the localhost web server";
        self.image = [NSImage imageNamed:NSImageNameComputer];
        self.launchdEnabled = YES;
        self.installEnabled = YES;
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
  return KBPathInDir(dir, path, NO, NO);
}

+ (instancetype)loadFromUserDefaults:(NSUserDefaults *)userDefaults {
  NSString *homeDir = [userDefaults stringForKey:@"HomeDir"];
  NSString *mountDir = [userDefaults stringForKey:@"MountDir"];

  //if (!homeDir) homeDir = [KBEnvConfig groupContainer:@"dev"];
  if (!mountDir) mountDir = KBPath(@"~/Keybase.dev", NO, NO);

  return [[KBEnvConfig alloc] initWithHomeDir:homeDir sockFile:nil mountDir:mountDir];
}

- (void)saveToUserDefaults:(NSUserDefaults *)userDefaults {
  [userDefaults setObject:KBPath(self.homeDir, NO, NO) forKey:@"HomeDir"];
  [userDefaults setObject:KBPath(self.mountDir, NO, NO) forKey:@"MountDir"];
  [userDefaults synchronize];
}

- (NSString *)sockFile:(BOOL)useDefault {
  NSString *sockFile;
  if (_sockFile) {
    sockFile = _sockFile;
  } else {
    sockFile = KBPathInDir([self configDir], @"keybased.sock", NO, NO);
  }
  if ([sockFile length] > 103) {
    [NSException raise:NSInvalidArgumentException format:@"Sock path too long. It should be < 104 characters. %@", sockFile];
  }
  return sockFile;
}

- (NSString *)configDir {
  NSString *appName = @"Keybase";
  if (self.develMode) appName = @"KeybaseDev";
  return KBPathInDir(_homeDir, NSStringWithFormat(@"Library/Application Support/%@", appName), NO, NO);
}

- (NSString *)configFile:(BOOL)useDefault {
  NSString *configFile;
  if (_configFile) {
    configFile = _configFile;
  } else {
    configFile = KBPathInDir([self configDir], @"config.json", NO, NO);
  }
  return configFile;
}

+ (instancetype)env:(KBEnv)env {
  return [[self.class alloc] initWithEnv:env];
}

- (instancetype)initWithHomeDir:(NSString *)homeDir sockFile:(NSString *)sockFile mountDir:(NSString *)mountDir {
  if ((self = [super init])) {
    self.identifier = @"custom";
    self.title = @"Custom";
    self.homeDir = KBPath(homeDir, NO, NO);
    self.sockFile = KBPath(sockFile, NO, NO);
    self.mountDir = mountDir;
    self.info = @"For development";
    self.image = [NSImage imageNamed:NSImageNameAdvanced];
    self.launchdEnabled = NO;
    self.installEnabled = NO;
    self.debugEnabled = YES;
  }
  return self;
}

- (NSString *)cachePath:(NSString *)filename {
  return NSStringWithFormat(@"%@/.cache/keybase/%@", self.homeDir, filename);
}

- (NSArray *)programArgumentsForKeybase:(BOOL)useBundle escape:(BOOL)escape tilde:(BOOL)tilde service:(BOOL)service {
  NSMutableArray *args = [NSMutableArray array];
  if (useBundle) {
    [args addObject:NSStringWithFormat(@"%@/bin/keybase", self.bundle.sharedSupportPath)];
  } else {
    [args addObject:@"./keybase"];
  }
  if (_homeDir) {
    [args addObjectsFromArray:@[@"-H", KBPath(_homeDir, tilde, escape)]];
  }

  if (_host) {
    [args addObjectsFromArray:@[@"-s", _host]];
  }

  if (_debugEnabled) {
    [args addObject:@"-d"];
  }

  if (_sockFile) {
    [args addObject:NSStringWithFormat(@"--socket-file=%@", KBPath(_sockFile, tilde, escape))];
  }

  if (service) {
    // Run service (this should be the last arg)
    [args addObject:@"service"];
  }

  return args;
}

- (NSDictionary *)launchdPlistDictionaryForService {
  if (!self.launchdLabelService) return nil;

  NSArray *args = [self programArgumentsForKeybase:YES escape:NO tilde:NO service:YES];

  // Logging
  NSString *logDir = KBPath(@"~/Library/Logs/Keybase", NO, NO);
  // Need to create logging dir here because otherwise it might be created as root by launchctl.
  [NSFileManager.defaultManager createDirectoryAtPath:logDir withIntermediateDirectories:YES attributes:nil error:nil];

  return @{
           @"Label": self.launchdLabelService,
           @"ProgramArguments": args,
           @"RunAtLoad": @YES,
           @"KeepAlive": @YES,
           @"StandardOutPath": NSStringWithFormat(@"%@/%@.log", logDir, self.launchdLabelService),
           @"StandardErrorPath": NSStringWithFormat(@"%@/%@.err", logDir, self.launchdLabelService),
           };
}

- (NSBundle *)bundle {
#ifdef DEBUG
  return [NSBundle bundleWithPath:@"/Applications/Keybase.app"];
#else
  return NSBundle.mainBundle;
#endif
}

- (NSArray *)programArgumentsForKBFS:(BOOL)useBundle escape:(BOOL)escape tilde:(BOOL)tilde {
  NSMutableArray *args = [NSMutableArray array];

  if (useBundle) {
    [args addObject:NSStringWithFormat(@"%@/bin/kbfsfuse", self.bundle.sharedSupportPath)];
  } else {
    [args addObject:@"./kbfsfuse"];
  }

  [args addObject:@"-client"];
  if (self.mountDir) [args addObject:KBPath(self.mountDir, tilde, escape)];

  return args;
}

- (NSString *)commandLineForService:(BOOL)useBundle escape:(BOOL)escape tilde:(BOOL)tilde {
  return [[self programArgumentsForKeybase:useBundle escape:escape tilde:tilde service:YES] join:@" "];
}

- (GHODictionary *)envsForKBS:(BOOL)tilde escape:(BOOL)escape {
  GHODictionary *envs = [GHODictionary dictionary];
  envs[@"PATH"] = @"/sbin:/Library/Filesystems/kbfuse.fs/Support"; // For umount, mount_osxfusefs
  envs[@"KEYBASE_SOCKET_FILE"] = KBPath([self sockFile:YES], tilde, escape);
  envs[@"KEYBASE_CONFIG_FILE"] = KBPath([self configFile:YES], tilde, escape);
  return envs;
}

- (NSDictionary *)launchdPlistDictionaryForKBFS {
  if (!self.launchdLabelKBFS) return nil;

  NSArray *args = [self programArgumentsForKBFS:YES escape:NO tilde:NO];
  GHODictionary *envs = [self envsForKBS:NO escape:NO];

  // Logging
  NSString *logDir = KBPath(@"~/Library/Logs/Keybase", NO, NO);
  // Need to create logging dir here because otherwise it might be created as root by launchctl.
  [NSFileManager.defaultManager createDirectoryAtPath:logDir withIntermediateDirectories:YES attributes:nil error:nil];

  return @{
           @"Label": self.launchdLabelKBFS,
           @"EnvironmentVariables": envs,
           @"ProgramArguments": args,
           @"RunAtLoad": @YES,
           @"KeepAlive": @YES,
           @"StandardOutPath": NSStringWithFormat(@"%@/%@.log", logDir, self.launchdLabelKBFS),
           @"StandardErrorPath": NSStringWithFormat(@"%@/%@.err", logDir, self.launchdLabelKBFS),
           };
}

- (NSString *)commandLineForKBFS:(BOOL)useBundle escape:(BOOL)escape tilde:(BOOL)tilde {
  NSString *envs = [[[self envsForKBS:tilde escape:escape] map:^(id key, id value) { return NSStringWithFormat(@"%@=%@", key, value); }] join:@" "];
  NSString *args = [[self programArgumentsForKBFS:useBundle escape:escape tilde:tilde] join:@" "];
  return NSStringWithFormat(@"%@ %@", envs, args);
}

- (BOOL)validate:(NSError **)error {
  if (!_homeDir) {
    if (error) *error = KBMakeError(-1, @"You need to specify a home directory");
    return NO;
  }
  if (![NSFileManager.defaultManager fileExistsAtPath:KBPath(_homeDir, NO, NO) isDirectory:nil]) {
    if (error) *error = KBMakeError(-1, @"%@ doesn't exist", _homeDir);
    return NO;
  }
  if (_sockFile && ![NSFileManager.defaultManager fileExistsAtPath:KBPath(_sockFile, NO, NO) isDirectory:nil]) {
    if (error) *error = KBMakeError(-1, @"%@ doesn't exist", _sockFile);
    return NO;
  }
  if (![NSFileManager.defaultManager fileExistsAtPath:KBPath(_mountDir, NO, NO) isDirectory:nil]) {
    if (error) *error = KBMakeError(-1, @"%@ doesn't exist", _mountDir);
    return NO;
  }
  return YES;
}

@end