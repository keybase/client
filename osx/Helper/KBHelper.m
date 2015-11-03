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

  NSDictionary *args = [params count] == 1 ? params[0] : nil;

  if ([method isEqualToString:@"version"]) {
    [self version:completion];
  } else if ([method isEqualToString:@"kbfs_load"]) {
    KBFS *kbfs = [[KBFS alloc] init];
    [kbfs loadKextID:args[@"kextID"] path:args[@"kextPath"] completion:completion];
  } else if ([method isEqualToString:@"kbfs_unload"]) {
    KBFS *kbfs = [[KBFS alloc] init];
    [kbfs unloadWithKextLabel:args[@"kextID"] completion:completion];
  } else if ([method isEqualToString:@"kbfs_install"]) {
    KBFS *kbfs = [[KBFS alloc] init];
    [kbfs installOrUpdateWithSource:args[@"source"] destination:args[@"destination"] kextID:args[@"kextID"] completion:completion];
  } else if ([method isEqualToString:@"kbfs_uninstall"]) {
    KBFS *kbfs = [[KBFS alloc] init];
    [kbfs uninstallWithDestination:args[@"destination"] kextID:args[@"kextID"] completion:completion];
  } else {
    completion(KBMakeError(MPXPCErrorCodeUnknownRequest, @"Unknown request method"), nil);
  }
}

- (void)version:(void (^)(NSError *error, id value))completion {
  NSString *version = NSBundle.mainBundle.infoDictionary[@"CFBundleShortVersionString"];
  NSString *build = NSBundle.mainBundle.infoDictionary[@"CFBundleVersion"];
  NSDictionary *response = @{
                             @"version": version,
                             @"build": build,
                             };
  completion(nil, response);
}

@end
