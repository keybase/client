//
//  KBHelper.m
//  Keybase
//
//  Created by Gabriel on 4/20/15.
//  Copyright (c) 2015 Gabriel Handford. All rights reserved.
//

#import "KBHelper.h"

#import "KBFS.h"
#import "KBHelperDefines.h"
#import "KBLaunchCtl.h"
#import "KBCLIInstall.h"

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
  } else if ([method isEqualToString:@"kbfs_install"]) {
    KBFS *kbfs = [[KBFS alloc] init];
    [kbfs installOrUpdate:completion];
  } else if ([method isEqualToString:@"kbfs_uninstall"]) {
    KBFS *kbfs = [[KBFS alloc] init];
    [kbfs uninstall:completion];
  } else if ([method isEqualToString:@"cli_install"]) {
    [self installCLI:completion];
  } else {
    completion(KBMakeError(MPXPCErrorCodeUnknownRequest, @"Unknown request method"), nil);
  }
}

- (void)version:(void (^)(NSError *error, id value))completion {
  KBFS *kbfs = [[KBFS alloc] init];
  NSString *version = NSBundle.mainBundle.infoDictionary[@"CFBundleShortVersionString"];
  NSDictionary *response = @{
                             @"version": version,
                             @"fuseBundleVersion": KBOrNull(kbfs.bundleVersion),
                             @"fuseInstalledVersion": KBOrNull(kbfs.installedVersion),
                             @"fuseRunningVersion": KBOrNull(kbfs.runningVersion),
                             };
  completion(nil, response);
}

- (void)installCLI:(void (^)(NSError *error, id value))completion {
  NSError *error = nil;

  [NSFileManager.defaultManager removeItemAtPath:LINK_SOURCE error:nil];

  if (![NSFileManager.defaultManager createSymbolicLinkAtPath:LINK_SOURCE withDestinationPath:LINK_DESTINATION error:&error]) {
    if (!error) error = KBMakeError(-1, @"Unable to create keybase symlink");
    completion(error, @(0));
  } else {
    completion(nil, @(1));
  }
}

/*
- (void)uninstall:(KBOnCompletion)completion {
  NSString *plist = @"/Library/LaunchDaemons/keybase.Helper.plist";
  [KBLaunchCtl unload:plist disable:NO completion:^(NSError *error, NSString *output) {
    [NSFileManager.defaultManager removeItemAtPath:plist error:nil];
    [NSFileManager.defaultManager removeItemAtPath:@"/Library/PrivilegedHelperTools/keybase.Helper" error:nil];
    completion(nil, nil);
  }];
}
 */

@end
