//
//  KBUninstaller.m
//  Keybase
//
//  Created by Gabriel on 6/11/15.
//  Copyright (c) 2015 Keybase. All rights reserved.
//

#import "KBUninstaller.h"
#import "KBLaunchCtl.h"
#import "KBRunOver.h"
#import <CocoaLumberjack/CocoaLumberjack.h>

@implementation KBUninstaller

+ (void)uninstall:(NSString *)prefix completion:(KBCompletion)completion {
  NSAssert([prefix length] > 2, @"Must have a prefix");
  NSFileManager *fileManager = NSFileManager.defaultManager;
  NSDirectoryEnumerator *enumerator = [fileManager enumeratorAtURL:KBURLPath(@"~/Library/LaunchAgents/", YES, NO, NO)  includingPropertiesForKeys:@[NSURLIsRegularFileKey] options:0 errorHandler:^(NSURL *url, NSError *error) {
    return YES;
  }];

  KBRunOver *rover = [[KBRunOver alloc] init];
  rover.enumerator = enumerator;
  rover.runBlock = ^(NSURL *URL, KBRunCompletion runCompletion) {
    if ([[URL.path lastPathComponent] hasPrefix:prefix]) {
      DDLogDebug(@"Unloading %@", URL.path);
      [KBLaunchCtl unload:URL.path label:nil disable:NO completion:^(NSError *error, NSString *output) {
        DDLogDebug(@"Removing %@", URL.path);
        [fileManager removeItemAtPath:KBPath(URL.path, NO, NO) error:nil];
        runCompletion(URL);
      }];
    } else {
      runCompletion(URL);
    }
  };
  rover.completion = ^(NSArray *outputs) {
    [self deleteAll:@"~/Library/Application Support/Keybase"];
    completion(nil);
  };
  [rover run];
}

+ (void)deleteAll:(NSString *)dir {
  NSFileManager *fileManager = NSFileManager.defaultManager;
  NSDirectoryEnumerator *enumerator = [fileManager enumeratorAtPath:KBPath(dir, NO, NO)];
  for (NSString *file in enumerator) {
    DDLogDebug(@"Removing %@", file);
    NSError *error = nil;
    if (![fileManager removeItemAtPath:KBPathInDir(dir, file, NO, NO) error:&error]) {
      DDLogError(@"Error: %@", error);
    }
  }
}

@end
