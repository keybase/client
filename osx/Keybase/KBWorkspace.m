//
//  KBWorkspace.m
//  Keybase
//
//  Created by Gabriel on 6/8/15.
//  Copyright (c) 2015 Keybase. All rights reserved.
//

#import "KBWorkspace.h"

#import "KBDefines.h"
#import "KBAlert.h"
#import <ObjectiveSugar/ObjectiveSugar.h>

@implementation KBWorkspace

//+ (NSString *)bundleFile:(NSString *)file {
//  NSString *path = [[NSBundle mainBundle] pathForResource:[file stringByDeletingPathExtension] ofType:[file pathExtension]];
//  NSString *contents = [NSString stringWithContentsOfFile:path encoding:NSUTF8StringEncoding error:NULL];
//  NSAssert(contents, @"No contents at file: %@", file);
//  return contents;
//}

+ (NSString *)currentUsername {
  return [[NSApp delegate] currentUsername];
}

+ (NSString *)APIURLString:(NSString *)path {
  return [[NSApp delegate] APIURLString:path];
}

+ (NSUserDefaults *)userDefaults {
  static NSUserDefaults *userDefaults;
  static dispatch_once_t onceToken;
  dispatch_once(&onceToken, ^{
    userDefaults = [[NSUserDefaults alloc] initWithSuiteName:@"group.keybase.Keybase"];
  });
  return userDefaults;
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

+ (void)openURLString:(NSString *)URLString sender:(id)sender {
  [KBAlert yesNoWithTitle:@"Open a Link" description:NSStringWithFormat(@"Do you want to open %@?", URLString) yes:@"Open" view:sender completion:^(BOOL yes) {
    if (yes) [NSWorkspace.sharedWorkspace openURL:[NSURL URLWithString:URLString]];
  }];
}

@end
