//
//  KBEnvironment.m
//  Keybase
//
//  Created by Gabriel on 4/22/15.
//  Copyright (c) 2015 Gabriel Handford. All rights reserved.
//

#import "KBEnvironment.h"
#import "KBAppKit.h"

@implementation KBEnvironment

- (instancetype)initWithEnv:(KBEnv)env {
  if ((self = [super init])) {
    switch (env) {
      case KBEnvKeybaseIO: {
        self.title = @"Keybase.io";
        self.launchdLabel = @"keybase.io.keybased";
        self.home = [NSStringWithFormat(@"~/Library/Application Support/Keybase/%@", self.launchdLabel) stringByExpandingTildeInPath];
        self.host = @"https://api.keybase.io:443";
        self.debugEnabled = YES;
        break;
      }
      case KBEnvLocalhost: {
        self.title = @"Localhost";
        self.launchdLabel = @"keybase.localhost.keybased";
        self.home = [NSStringWithFormat(@"~/Library/Application Support/Keybase/%@", self.launchdLabel) stringByExpandingTildeInPath];
        self.host = @"http://localhost:3000";
        self.debugEnabled = YES;
        break;
      }
      case KBEnvManual: {
        self.title = @"Manual";
        self.home = [@"~/Library/Application Support/Keybase/Debug" stringByExpandingTildeInPath];
        self.host = @"http://localhost:3000";
        self.launchdLabel = nil;
        self.canRunFromXCode = YES;
      }
    }

    // This is because there is a hard limit of 104 characters for the unix socket file length and if
    // we the default there is a chance it will be too long (if username is long).
    self.sockFile = [self.home stringByAppendingPathComponent:@".config/kb.sock"];
    if ([[self.sockFile stringByExpandingTildeInPath] length] > 103) {
      [NSException raise:NSInvalidArgumentException format:@"Sock path too long. It should be < 104 characters."];
    }
  }
  return self;
}

+ (instancetype)env:(KBEnv)env {
  return [[self.class alloc] initWithEnv:env];
}

@end
