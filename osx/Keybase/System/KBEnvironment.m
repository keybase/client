//
//  KBEnvironment.m
//  Keybase
//
//  Created by Gabriel on 4/22/15.
//  Copyright (c) 2015 Gabriel Handford. All rights reserved.
//

#import "KBEnvironment.h"
#import "KBAppKit.h"

@interface KBEnvironment ()
@property NSString *homeDir;
@property NSString *host;
@property (getter=isDebugEnabled) BOOL debugEnabled;
@property NSString *mountDir;
@property NSString *sockFile;
@property NSString *configFile;
@property NSString *identifier;
@property NSString *launchdLabelService;
@property NSString *launchdLabelKBFS;
@property NSString *title;
@property NSString *info;
@property NSImage *image;
@property BOOL canRunFromXCode;
@end

@implementation KBEnvironment

- (instancetype)initWithEnv:(KBEnv)env {
  if ((self = [super init])) {
    switch (env) {
      case KBEnvKeybaseIO: {
        self.title = @"Keybase.io";
        self.identifier = @"keybase_io";
        self.homeDir = [NSStringWithFormat(@"~/Library/Application Support/Keybase/%@", self.identifier) stringByExpandingTildeInPath];
        self.host = @"https://api.keybase.io:443";
        self.mountDir = [@"~/Keybase" stringByExpandingTildeInPath];
        self.debugEnabled = YES;
        self.info = @"This uses api.keybase.io.";
        self.image = [NSImage imageNamed:NSImageNameNetwork];
        break;
      }
      case KBEnvLocalhost: {
        self.title = @"Localhost";
        self.identifier = @"localhost";
        self.homeDir = [NSStringWithFormat(@"~/Library/Application Support/Keybase/%@", self.identifier) stringByExpandingTildeInPath];
        self.host = @"http://localhost:3000";
        self.mountDir = [@"~/Keybase.localhost" stringByExpandingTildeInPath];
        self.debugEnabled = YES;
        self.info = @"This uses the localhost web server.";
        self.image = [NSImage imageNamed:NSImageNameComputer];
        break;
      }
      case KBEnvManual: {
        self.title = @"Manual";
        self.homeDir = [@"~/Library/Application Support/Keybase/Debug" stringByExpandingTildeInPath];
        self.host = @"http://localhost:3000";
        self.info = @"Choose this if running from xCode.";
        self.canRunFromXCode = YES;
        self.image = [NSImage imageNamed:NSImageNameAdvanced];
      }
    }

    if (self.identifier) {
      self.launchdLabelService = NSStringWithFormat(@"keybase.Service.%@", self.identifier);
      self.launchdLabelKBFS = NSStringWithFormat(@"keybase.KBFS.%@", self.identifier);
    }

    // This is because there is a hard limit of 104 characters for the unix socket file length and if
    // we use the default there is a chance it will be too long (if username is long).
    self.sockFile = [self.homeDir stringByAppendingPathComponent:@".config/kb.sock"];
    if ([[self.sockFile stringByExpandingTildeInPath] length] > 103) {
      [NSException raise:NSInvalidArgumentException format:@"Sock path too long. It should be < 104 characters."];
    }

    self.configFile = NSStringWithFormat(@"%@/.config/keybase/config.json", self.homeDir);
  }
  return self;
}

+ (instancetype)env:(KBEnv)env {
  return [[self.class alloc] initWithEnv:env];
}

- (NSDictionary *)launchdPlistDictionaryForService {
  if (!self.launchdLabelService) return nil;

  NSMutableArray *args = [NSMutableArray array];
  [args addObject:@"/Applications/Keybase.app/Contents/SharedSupport/bin/keybase"];
  [args addObjectsFromArray:@[@"-H", _homeDir]];

  if (_host) {
    [args addObjectsFromArray:@[@"-s", _host]];
  }

  if (_debugEnabled) {
    [args addObject:@"-d"];
  }

  // This is because there is a hard limit of 104 characters for the unix socket file length and if
  // we the default there is a chance it will be too long (if username is long).
  [args addObject:NSStringWithFormat(@"--socket-file=%@", _sockFile)];

  // Run service (this should be the last arg)
  [args addObject:@"service"];

  // Logging
  NSString *logDir = [@"~/Library/Logs/Keybase" stringByExpandingTildeInPath];
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

- (NSDictionary *)launchdPlistDictionaryForKBFS {
  if (!self.launchdLabelKBFS) return nil;

  NSMutableArray *args = [NSMutableArray array];
  [args addObject:@"/Applications/Keybase.app/Contents/SharedSupport/bin/kbfsfuse"];

  [args addObject:@"-client"];
  [args addObject:self.mountDir];

  NSMutableDictionary *envs = [NSMutableDictionary dictionary];
  envs[@"KEYBASE_SOCKET_FILE"] = self.sockFile;
  envs[@"KEYBASE_CONFIG_FILE"] = self.configFile;

  // Logging
  NSString *logDir = [@"~/Library/Logs/Keybase" stringByExpandingTildeInPath];
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

@end
