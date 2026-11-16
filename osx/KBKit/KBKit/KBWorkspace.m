//
//  KBWorkspace.m
//  Keybase
//
//  Created by Gabriel on 6/8/15.
//  Copyright (c) 2015 Keybase. All rights reserved.
//

#import "KBWorkspace.h"

#import "KBLogFormatter.h"

#import <CocoaLumberjack/CocoaLumberjack.h>

@implementation KBWorkspace

+ (void)setupLogging:(BOOL)debug {
  static dispatch_once_t onceToken;
  dispatch_once(&onceToken, ^{
    DDTTYLogger.sharedInstance.logFormatter = [[KBLogFormatter alloc] init];
    [DDLog addLogger:DDTTYLogger.sharedInstance withLevel:debug ? DDLogLevelDebug : DDLogLevelInfo]; // Xcode output
  });
}

@end

