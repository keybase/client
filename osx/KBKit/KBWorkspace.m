//
//  KBWorkspace.m
//  Keybase
//
//  Created by Gabriel on 6/8/15.
//  Copyright (c) 2015 Keybase. All rights reserved.
//

#import "KBWorkspace.h"

#import "KBAlert.h"
#import "KBLogFormatter.h"
#import "KBDefines.h"
#import "KBFormatter.h"

#import <ObjectiveSugar/ObjectiveSugar.h>
#import <CocoaLumberjack/CocoaLumberjack.h>

@implementation KBWorkspace

// The workspace user defaults uses the shared App Group container, so
// extensions and the app can share preferences.
+ (NSUserDefaults *)userDefaults {
  static NSUserDefaults *userDefaults;
  static dispatch_once_t onceToken;
  dispatch_once(&onceToken, ^{
    userDefaults = [[NSUserDefaults alloc] initWithSuiteName:KBAppGroupId];
  });
  return userDefaults;
}

+ (void)setupLogging {
  static dispatch_once_t onceToken;
  dispatch_once(&onceToken, ^{
    DDTTYLogger.sharedInstance.logFormatter = [[KBLogFormatter alloc] init];
    [DDLog addLogger:DDTTYLogger.sharedInstance withLevel:DDLogLevelDebug]; // Xcode output
  });
}

+ (NSString *)applicationSupport:(NSArray *)subdirs create:(BOOL)create error:(NSError **)error {
  NSString *directory = [NSSearchPathForDirectoriesInDomains(NSApplicationSupportDirectory, NSUserDomainMask, YES) firstObject];
  if (!directory) {
    if (error) *error = KBMakeError(-1, @"No application support directory");
    return nil;
  }
  directory = [directory stringByAppendingPathComponent:@"Keybase"];
  if (subdirs) {
    for (NSString *subdir in subdirs) {
      directory = [directory stringByAppendingPathComponent:subdir];
    }
  }

  if (create && ![NSFileManager.defaultManager fileExistsAtPath:directory]) {
    [NSFileManager.defaultManager createDirectoryAtPath:directory withIntermediateDirectories:YES attributes:nil error:error];
    if (error) {
      return nil;
    }
  }
  return directory;
}

+ (void)openURLString:(NSString *)URLString prompt:(BOOL)prompt sender:(id)sender {
  if (!prompt) {
    [NSWorkspace.sharedWorkspace openURL:[NSURL URLWithString:URLString]];
  } else {
    [KBAlert yesNoWithTitle:@"Open a Link" description:NSStringWithFormat(@"Do you want to open %@?", URLString) yes:@"Open" view:sender completion:^(BOOL yes) {
      if (yes) [NSWorkspace.sharedWorkspace openURL:[NSURL URLWithString:URLString]];
    }];
  }
}

@end


