//
//  KBHelper.m
//  Keybase
//
//  Created by Gabriel on 4/20/15.
//  Copyright (c) 2015 Gabriel Handford. All rights reserved.
//

#import "KBHelper.h"

#import "KBKext.h"

#import <MPMessagePack/MPXPCProtocol.h>

@implementation KBHelper

+ (int)run {
  NSString *version = NSBundle.mainBundle.infoDictionary[@"CFBundleShortVersionString"];
  NSString *bundleVersion = NSBundle.mainBundle.infoDictionary[@"CFBundleVersion"];

  KBLog(@"Starting keybase.Helper: %@-%@", version, bundleVersion);

  xpc_connection_t service = xpc_connection_create_mach_service("keybase.Helper", dispatch_get_main_queue(), XPC_CONNECTION_MACH_SERVICE_LISTENER);
  if (!service) {
    KBLog(@"Failed to create service.");
    return EXIT_FAILURE;
  }

  @try {
    KBHelper *helper = [[KBHelper alloc] init];
    [helper listen:service];

    dispatch_main();
  } @catch(NSException *e) {
    KBLog(@"Exception: %@", e);
  }

  return 0;
}

- (void)handleRequestWithMethod:(NSString *)method params:(NSArray *)params messageId:(NSNumber *)messageId completion:(void (^)(NSError *error, id value))completion {
  @try {
    [self _handleRequestWithMethod:method params:params messageId:messageId completion:completion];
  } @catch (NSException *e) {
    KBLog(@"Exception: %@", e);
    completion(KBMakeError(MPXPCErrorCodeInvalidRequest, @"Exception: %@", e), nil);
  }
}

- (NSString *)checkKextID:(NSString *)kextID {
  NSString * const kbfuseKextID = @"com.github.kbfuse.filesystems.kbfuse";
  NSString * const fuse3KextID = @"com.github.osxfuse.filesystems.osxfuse";
  if ([kextID isEqualToString:kbfuseKextID]) return kbfuseKextID;
  if ([kextID isEqualToString:fuse3KextID]) return fuse3KextID;
  return nil;
}

- (void)_handleRequestWithMethod:(NSString *)method params:(NSArray *)params messageId:(NSNumber *)messageId completion:(void (^)(NSError *error, id value))completion {
  NSDictionary *args = [params count] == 1 ? params[0] : @{};

  KBLog(@"Request: %@(%@)", method, args);

  if (![args isKindOfClass:NSDictionary.class]) {
    completion(KBMakeError(MPXPCErrorCodeInvalidRequest, @"Invalid args"), nil);
    return;
  }

  if ([method isEqualToString:@"version"]) {
    [self version:completion];
  } else if ([method isEqualToString:@"kext_load"]) {
    [KBKext loadKextID:args[@"kextID"] path:args[@"kextPath"] completion:completion];
  } else if ([method isEqualToString:@"kext_unload"]) {
    // For some reason passing through args[@"kextID"] causes the helper to crash on kext_unload only.
    // TODO: Figure out why. (Maybe string has to be const?)
    NSString *kextID = [self checkKextID:args[@"kextID"]];
    if (kextID) {
      [KBKext unloadKextID:kextID force:YES completion:completion];
    } else {
      completion(KBMakeError(MPXPCErrorCodeInvalidRequest, @"Invalid kextID"), nil);
    }
  } else if ([method isEqualToString:@"kext_install"]) {
    [KBKext installOrUpdateWithSource:args[@"source"] destination:args[@"destination"] kextID:args[@"kextID"] kextPath:args[@"kextPath"] completion:completion];
  } else if ([method isEqualToString:@"kext_uninstall"]) {
    [KBKext uninstallWithDestination:args[@"destination"] kextID:args[@"kextID"] completion:completion];
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
