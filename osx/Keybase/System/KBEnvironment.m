//
//  KBEnvironment.m
//  Keybase
//
//  Created by Gabriel on 4/22/15.
//  Copyright (c) 2015 Gabriel Handford. All rights reserved.
//

#import "KBEnvironment.h"

@implementation KBEnvironment

- (instancetype)initWithEnv:(KBEnv)env {
  if ((self = [super init])) {
    switch (env) {
      case KBEnvKeybaseIO: {
        self.title = @"Keybase.io";
        self.home = [@"~/Library/Application Support/Keybase/keybase.io" stringByExpandingTildeInPath];
        self.host = @"https://api.keybase.io:443";
        self.launchDLabel = @"keybase.io.keybased";
        self.debugEnabled = YES;
        break;
      }
      case KBEnvLocalhost: {
        self.title = @"Localhost";
        self.home = [@"~/Library/Application Support/Keybase/localhost" stringByExpandingTildeInPath];
        self.host = @"http://localhost:3000";
        self.launchDLabel = @"keybase.localhost.keybased";
        self.debugEnabled = YES;
        break;
      }
      case KBEnvManual: {
        self.title = @"Manual";
        self.home = [@"~/Library/Application Support/Keybase/Debug" stringByExpandingTildeInPath];
        self.host = @"http://localhost:3000";
        self.launchDLabel = nil;
        self.canRunFromXCode = YES;
      }
    }

    self.sockFile = [self.home stringByAppendingPathComponent:@".config/keybase/keybased.sock"];
  }
  return self;
}

+ (instancetype)env:(KBEnv)env {
  return [[self.class alloc] initWithEnv:env];
}

@end
