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

  KBLog(@"Starting keybase.Helper: %@", version);

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
  } else if ([method isEqualToString:@"kextLoad"]) {
    [KBKext loadKextID:args[@"kextID"] path:args[@"kextPath"] completion:completion];
  } else if ([method isEqualToString:@"kextUnload"]) {
    // For some reason passing through args[@"kextID"] causes the helper to crash on kextUnload only.
    // TODO: Figure out why. (Maybe string has to be const?)
    NSString *kextID = [self checkKextID:args[@"kextID"]];
    if (kextID) {
      [KBKext unloadKextID:kextID completion:completion];
    } else {
      completion(KBMakeError(MPXPCErrorCodeInvalidRequest, @"Invalid kextID"), nil);
    }
  } else if ([method isEqualToString:@"kextInstall"]) {
    [KBKext installWithSource:args[@"source"] destination:args[@"destination"] kextID:args[@"kextID"] kextPath:args[@"kextPath"] completion:completion];
  } else if ([method isEqualToString:@"kextUninstall"]) {
    [KBKext uninstallWithDestination:args[@"destination"] kextID:args[@"kextID"] completion:completion];
  } else if ([method isEqualToString:@"trash"]) {
    [self trash:args[@"path"] completion:completion];
  } else if ([method isEqualToString:@"createDirectory"]) {
    [self createDirectory:args[@"directory"] uid:args[@"uid"] gid:args[@"gid"] permissions:args[@"permissions"] completion:completion];
  } else {
    completion(KBMakeError(MPXPCErrorCodeUnknownRequest, @"Unknown request method"), nil);
  }
}

- (void)version:(void (^)(NSError *error, id value))completion {
  NSString *version = NSBundle.mainBundle.infoDictionary[@"CFBundleShortVersionString"];
  NSDictionary *response = @{
                             @"version": version,
                             };
  completion(nil, response);
}

- (void)createDirectory:(NSString *)directory uid:(NSNumber *)uid gid:(NSNumber *)gid permissions:(NSNumber *)permissions completion:(void (^)(NSError *error, id value))completion {
  NSMutableDictionary *attributes = [NSMutableDictionary dictionary];
  attributes[NSFilePosixPermissions] = permissions;
  attributes[NSFileOwnerAccountID] = uid;
  attributes[NSFileGroupOwnerAccountID] = gid;

  NSError *error = nil;
  if (![NSFileManager.defaultManager createDirectoryAtPath:directory withIntermediateDirectories:YES attributes:attributes error:&error]) {
    completion(error, nil);
    return;
  }

  completion(nil, @{});
}

- (void)trash:(NSString *)path completion:(void (^)(NSError *error, id value))completion {
  NSError *error = nil;
  // The caller should check the path too but let's be safer and prevent some bad paths
  if (!path || ![path hasPrefix:@"/"] || [path isEqualToString:@"/"]) {
    completion(KBMakeError(MPXPCErrorCodeInvalidRequest, @"Invalid path"), nil);
    return;
  }

  NSURL *outURL = nil;
  if (![NSFileManager.defaultManager trashItemAtURL:[NSURL fileURLWithPath:path] resultingItemURL:&outURL error:&error]) {
    completion(error, nil);
  } else {
    completion(nil, @{@"outURL": [outURL absoluteString]});
  }
}

@end
