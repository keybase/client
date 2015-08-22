//
//  KBHelper.m
//  Keybase
//
//  Created by Gabriel on 4/20/15.
//  Copyright (c) 2015 Gabriel Handford. All rights reserved.
//

#import "KBHelper.h"

#import "KBFS.h"

#import <MPMessagePack/MPXPCProtocol.h>

@implementation KBHelper

- (void)handleRequestWithMethod:(NSString *)method params:(NSArray *)params messageId:(NSNumber *)messageId completion:(void (^)(NSError *error, id value))completion {
  KBLog(@"Request: %@(%@)", method, params ? params : @"");

  if ([method isEqualToString:@"version"]) {
    [self version:completion];
  } else if ([method isEqualToString:@"kbfs_load"]) {
    KBFS *kbfs = [[KBFS alloc] init];
    [kbfs load:completion];
  } else if ([method isEqualToString:@"kbfs_unload"]) {
    KBFS *kbfs = [[KBFS alloc] init];
    [kbfs unload:completion];
  } else if ([method isEqualToString:@"kbfs_info"]) {
    KBFS *kbfs = [[KBFS alloc] init];
    [kbfs info:completion];
  } else if ([method isEqualToString:@"kbfs_install"]) {
    KBFS *kbfs = [[KBFS alloc] init];
    [kbfs installOrUpdate:completion];
  } else if ([method isEqualToString:@"kbfs_uninstall"]) {
    KBFS *kbfs = [[KBFS alloc] init];
    [kbfs uninstall:completion];
  } else if ([method isEqualToString:@"cli_install"]) {
    NSString *destination = params[0][@"path"];
    [self installCLI:destination completion:completion];
  } else {
    completion(KBMakeError(MPXPCErrorCodeUnknownRequest, @"Unknown request method"), nil);
  }
}

- (void)version:(void (^)(NSError *error, id value))completion {
  KBFS *kbfs = [[KBFS alloc] init];
  NSString *version = NSBundle.mainBundle.infoDictionary[@"CFBundleShortVersionString"];
  NSString *build = NSBundle.mainBundle.infoDictionary[@"CFBundleVersion"];
  NSDictionary *response = @{
                             @"version": version,
                             @"build": build,
                             @"fuseBundleVersion": KBOr(kbfs.bundleVersion, @""),
                             @"fuseInstalledVersion": KBOr(kbfs.installedVersion, @""),
                             @"fuseRunningVersion": KBOr(kbfs.runningVersion, @""),
                             };
  completion(nil, response);
}

- (void)installCLI:(NSString *)destination completion:(void (^)(NSError *error, id value))completion {
  NSError *error = nil;

  NSString *linkSource = @"/usr/local/bin";

  [NSFileManager.defaultManager removeItemAtPath:linkSource error:nil];

  if (![NSFileManager.defaultManager createSymbolicLinkAtPath:linkSource withDestinationPath:destination error:&error]) {
    if (!error) error = KBMakeError(-1, @"Unable to create keybase symlink");
    completion(error, @(0));
  } else {
    completion(nil, @(1));
  }
}

@end
