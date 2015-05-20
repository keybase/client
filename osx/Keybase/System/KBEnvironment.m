//
//  KBEnvironment.m
//  Keybase
//
//  Created by Gabriel on 4/22/15.
//  Copyright (c) 2015 Gabriel Handford. All rights reserved.
//

#import "KBEnvironment.h"
#import "KBAppKit.h"
#import "KBAppDefines.h"

@interface KBEnvironment ()
@property NSString *homeDir;
@property NSString *host;
@property (getter=isDebugEnabled) BOOL debugEnabled;
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

@implementation KBEnvironment

- (instancetype)initWithEnv:(KBEnv)env {
  if ((self = [super init])) {
    switch (env) {
      case KBEnvKeybaseIO: {
        self.title = @"Keybase.io";
        self.identifier = @"keybase_io";
        self.homeDir = KBPath(@"~", NO);
        self.host = @"https://api.keybase.io:443";
        self.mountDir = KBPath(@"~/Keybase", NO);
        self.debugEnabled = YES;
        self.info = @"Uses api.keybase.io.";
        self.image = [NSImage imageNamed:NSImageNameNetwork];
        self.launchdEnabled = YES;
        self.installEnabled = YES;
        break;
      }
      case KBEnvLocalhost: {
        self.title = @"Localhost";
        self.identifier = @"localhost";
        self.homeDir = KBPath(NSStringWithFormat(@"~/Library/Application Support/Keybase/%@", self.identifier), NO);
        self.host = @"http://localhost:3000";
        self.mountDir = KBPath(@"~/Keybase.localhost", NO);
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

- (NSString *)sockFile:(BOOL)useDefault {
  NSString *sockFile;
  if (_sockFile) sockFile = _sockFile;
  else sockFile = KBPath(NSStringWithFormat(@"%@/.config/keybase/keybased.sock", _homeDir), NO);
  if ([sockFile length] > 103) {
    [NSException raise:NSInvalidArgumentException format:@"Sock path too long. It should be < 104 characters."];
  }
  return sockFile;
}

- (NSString *)configFile:(BOOL)useDefault {
  NSString *configFile;
  if (_configFile) configFile = _configFile;
  else configFile = KBPath(NSStringWithFormat(@"%@/.config/keybase/config.json", _homeDir), NO);
  return configFile;
}

+ (instancetype)env:(KBEnv)env {
  return [[self.class alloc] initWithEnv:env];
}

- (instancetype)initWithHomeDir:(NSString *)homeDir sockFile:(NSString *)sockFile mountDir:(NSString *)mountDir {
  if ((self = [super init])) {
    self.identifier = @"custom";
    self.title = @"Custom";
    self.homeDir = KBPath(homeDir, NO);
    self.sockFile = KBPath(sockFile, NO);
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

- (NSArray *)programArgumentsForService:(BOOL)useBundle escape:(BOOL)escape tilde:(BOOL)tilde {
  NSMutableArray *args = [NSMutableArray array];
  if (useBundle) {
    [args addObject:NSStringWithFormat(@"%@/bin/keybase", self.bundle.sharedSupportPath)];
  } else {
    [args addObject:@"./keybase"];
  }
  [args addObjectsFromArray:@[@"-H", KBPath(_homeDir, tilde)]];

  if (_host) {
    [args addObjectsFromArray:@[@"-s", _host]];
  }

  if (_debugEnabled) {
    [args addObject:@"-d"];
  }

  if (_sockFile) {
    [args addObject:NSStringWithFormat(@"--socket-file=%@", KBPath(_sockFile, tilde))];
  }

  // Run service (this should be the last arg)
  [args addObject:@"service"];

  if (escape) return [args map:^(NSString *arg) { return [arg stringByReplacingOccurrencesOfString:@" " withString:@"\\ "];  }];
  else return args;

  return args;
}

- (NSDictionary *)launchdPlistDictionaryForService {
  if (!self.launchdLabelService) return nil;

  NSArray *args = [self programArgumentsForService:YES escape:NO tilde:NO];

  // Logging
  NSString *logDir = KBPath(@"~/Library/Logs/Keybase", NO);
  // Need to create logging dir here because otherwise it might be created as root by launchctl.
  [NSFileManager.defaultManager createDirectoryAtPath:logDir withIntermediateDirectories:YES attributes:nil error:nil];

  return @{
           @"Label": self.launchdLabelService,
           @"ProgramArguments": args,
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
  [args addObject:KBPath(self.mountDir, tilde)];

  if (escape) return [args map:^(NSString *arg) { return [arg stringByReplacingOccurrencesOfString:@" " withString:@"\\ "];  }];
  else return args;
}

- (NSString *)commandLineForService:(BOOL)useBundle escape:(BOOL)escape tilde:(BOOL)tilde {
  return [[self programArgumentsForService:useBundle escape:escape tilde:tilde] join:@" "];
}

- (NSDictionary *)envsForKBS:(BOOL)tilde {
  NSMutableDictionary *envs = [NSMutableDictionary dictionary];
  envs[@"KEYBASE_SOCKET_FILE"] = KBPath([self sockFile:YES], tilde);
  envs[@"KEYBASE_CONFIG_FILE"] = KBPath([self configFile:YES], tilde);
  return envs;
}

- (NSDictionary *)launchdPlistDictionaryForKBFS {
  if (!self.launchdLabelKBFS) return nil;

  NSArray *args = [self programArgumentsForKBFS:YES escape:NO tilde:NO];
  NSDictionary *envs = [self envsForKBS:NO];

  // Logging
  NSString *logDir = KBPath(@"~/Library/Logs/Keybase", NO);
  // Need to create logging dir here because otherwise it might be created as root by launchctl.
  [NSFileManager.defaultManager createDirectoryAtPath:logDir withIntermediateDirectories:YES attributes:nil error:nil];

  return @{
           @"Label": self.launchdLabelKBFS,
           @"EnvironmentVariables": envs,
           @"ProgramArguments": args,
           @"KeepAlive": @YES,
           @"StandardOutPath": NSStringWithFormat(@"%@/%@.log", logDir, self.launchdLabelKBFS),
           @"StandardErrorPath": NSStringWithFormat(@"%@/%@.err", logDir, self.launchdLabelKBFS),
           };
}

- (NSString *)commandLineForKBFS:(BOOL)useBundle escape:(BOOL)escape tilde:(BOOL)tilde {
  NSString *envs = [[[self envsForKBS:tilde] map:^(id key, id value) { return NSStringWithFormat(@"%@=%@", key, value); }] join:@" "];
  NSString *args = [[self programArgumentsForKBFS:useBundle escape:escape tilde:tilde] join:@" "];
  return NSStringWithFormat(@"%@ %@", envs, args);
}

- (BOOL)validate:(NSError **)error {
  if (![NSFileManager.defaultManager fileExistsAtPath:KBPath(_homeDir, NO) isDirectory:nil]) {
    if (error) *error = KBMakeError(-1, @"%@ doesn't exist", _homeDir);
    return NO;
  }
  if (_sockFile && ![NSFileManager.defaultManager fileExistsAtPath:KBPath(_sockFile, NO) isDirectory:nil]) {
    if (error) *error = KBMakeError(-1, @"%@ doesn't exist", _sockFile);
    return NO;
  }
  if (![NSFileManager.defaultManager fileExistsAtPath:KBPath(_mountDir, NO) isDirectory:nil]) {
    if (error) *error = KBMakeError(-1, @"%@ doesn't exist", _mountDir);
    return NO;
  }
  return YES;
}

@end
