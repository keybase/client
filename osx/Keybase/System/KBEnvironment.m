//
//  KBEnvironment.m
//  Keybase
//
//  Created by Gabriel on 4/22/15.
//  Copyright (c) 2015 Gabriel Handford. All rights reserved.
//

#import "KBEnvironment.h"
#import "KBAppKit.h"
#import "KBDefines.h"

@interface KBEnvironment ()
@property NSString *homeDir;
@property NSString *host;
@property (getter=isDebugEnabled) BOOL debugEnabled;
@property NSString *mountDir;
@property NSString *sockFile;
@property NSString *configFile;
@property NSString *identifier;
@property (getter=isLaunchdEnabled) BOOL launchdEnabled;
@property NSString *launchdLabelService;
@property NSString *launchdLabelKBFS;
@property NSString *title;
@property NSString *info;
@property NSImage *image;
@property (getter=isInstallEnabled) BOOL installEnabled;
@end

@implementation KBEnvironment

- (instancetype)initWithEnv:(KBEnv)env {
  if ((self = [super init])) {
    switch (env) {
      case KBEnvKeybaseIO: {
        self.title = @"Keybase.io";
        self.identifier = @"keybase_io";
        self.homeDir = KBDir(@"~", NO);
        self.host = @"https://api.keybase.io:443";
        self.mountDir = KBDir(@"~/Keybase", NO);
        self.debugEnabled = YES;
        self.info = @"This uses api.keybase.io.";
        self.image = [NSImage imageNamed:NSImageNameNetwork];
        self.launchdEnabled = YES;
        self.installEnabled = YES;
        break;
      }
      case KBEnvLocalhost: {
        self.title = @"Localhost";
        self.identifier = @"localhost";
        self.homeDir = KBDir(NSStringWithFormat(@"~/Library/Application Support/Keybase/%@", self.identifier), NO);
        self.host = @"http://localhost:3000";
        self.mountDir = KBDir(@"~/Keybase.localhost", NO);
        self.debugEnabled = YES;
        self.info = @"This uses the localhost web server.";
        self.image = [NSImage imageNamed:NSImageNameComputer];
        self.launchdEnabled = YES;
        self.installEnabled = YES;
        break;
      }
      case KBEnvManual: {
        self.identifier = @"manual";
        self.title = @"Manual";
        self.homeDir = KBDir(@"~/Library/Application Support/Keybase/dev", NO);
        self.host = @"http://localhost:3000";
        self.info = @"Choose this if running from xCode.";
        self.mountDir = KBDir(@"~/Keybase.dev", NO);
        self.image = [NSImage imageNamed:NSImageNameAdvanced];
        self.launchdEnabled = NO;
        self.installEnabled = NO;
        break;
      }
    }

    if (self.isLaunchdEnabled) {
      self.launchdLabelService = NSStringWithFormat(@"keybase.Service.%@", self.identifier);
      self.launchdLabelKBFS = NSStringWithFormat(@"keybase.KBFS.%@", self.identifier);
    }

    // This is because there is a hard limit of 104 characters for the unix socket file length and if
    // we use the default there is a chance it will be too long (if username is long).
    self.sockFile = [self.homeDir stringByAppendingPathComponent:@".config/keybase/keybased.sock"];
    if ([self.sockFile length] > 103) {
      [NSException raise:NSInvalidArgumentException format:@"Sock path too long. It should be < 104 characters."];
    }

    self.configFile = NSStringWithFormat(@"%@/.config/keybase/config.json", self.homeDir);
  }
  return self;
}

+ (instancetype)env:(KBEnv)env {
  return [[self.class alloc] initWithEnv:env];
}

- (NSArray *)programArgumentsForService:(BOOL)tilde {
  NSMutableArray *args = [NSMutableArray array];
  [args addObject:@"/Applications/Keybase.app/Contents/SharedSupport/bin/keybase"];
  [args addObjectsFromArray:@[@"-H", KBDir(_homeDir, tilde)]];

  if (_host) {
    [args addObjectsFromArray:@[@"-s", _host]];
  }

  if (_debugEnabled) {
    [args addObject:@"-d"];
  }

  // This is because there is a hard limit of 104 characters for the unix socket file length and if
  // we the default there is a chance it will be too long (if username is long).
  [args addObject:NSStringWithFormat(@"--socket-file=%@", KBDir(_sockFile, tilde))];

  // Run service (this should be the last arg)
  [args addObject:@"service"];

  return args;
}

- (NSDictionary *)launchdPlistDictionaryForService {
  if (!self.launchdLabelService) return nil;

  NSArray *args = [self programArgumentsForService:NO];

  // Logging
  NSString *logDir = KBDir(@"~/Library/Logs/Keybase", NO);
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

- (NSArray *)programArgumentsForKBFS:(BOOL)tilde {
  NSMutableArray *args = [NSMutableArray array];
  [args addObject:@"/Applications/Keybase.app/Contents/SharedSupport/bin/kbfsfuse"];

  [args addObject:@"-client"];
  [args addObject:KBDir(self.mountDir, tilde)];

  return args;
}

- (NSString *)commandLineForService:(BOOL)tilde {
  return [[self programArgumentsForService:tilde] join:@" "];
}

- (NSDictionary *)envsForKBS:(BOOL)tilde {
  NSMutableDictionary *envs = [NSMutableDictionary dictionary];
  envs[@"KEYBASE_SOCKET_FILE"] = KBDir(self.sockFile, tilde);
  envs[@"KEYBASE_CONFIG_FILE"] = KBDir(self.configFile, tilde);
  return envs;
}

- (NSDictionary *)launchdPlistDictionaryForKBFS {
  if (!self.launchdLabelKBFS) return nil;

  NSArray *args = [self programArgumentsForKBFS:NO];
  NSDictionary *envs = [self envsForKBS:NO];

  // Logging
  NSString *logDir = KBDir(@"~/Library/Logs/Keybase", NO);
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

- (NSString *)commandLineForKBFS:(BOOL)tilde {
  NSString *envs = [[[self envsForKBS:tilde] map:^(id key, id value) { return NSStringWithFormat(@"%@=%@", key, value); }] join:@" "];
  NSString *args = [[self programArgumentsForKBFS:tilde] join:@" "];
  return NSStringWithFormat(@"%@ %@", envs, args);
}

@end
