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
  } else if ([method isEqualToString:@"kextCopy"]) {
    [KBKext copyWithSource:args[@"source"] destination:args[@"destination"] removeExisting:YES completion:completion];
  } else if ([method isEqualToString:@"remove"]) {
    [self remove:args[@"path"] completion:completion];
  } else if ([method isEqualToString:@"move"]) {
    [self moveFromSource:args[@"source"] destination:args[@"destination"] overwriteDestination:YES completion:completion];
  } else if ([method isEqualToString:@"createDirectory"]) {
    [self createDirectory:args[@"directory"] uid:args[@"uid"] gid:args[@"gid"] permissions:args[@"permissions"] excludeFromBackup:[args[@"excludeFromBackup"] boolValue] completion:completion];
  } else if ([method isEqualToString:@"addToPath"]) {
    [self addToPath:args[@"directory"] name:args[@"name"] appName:args[@"appName"] completion:completion];
  } else if ([method isEqualToString:@"removeFromPath"]) {
    [self removeFromPath:args[@"directory"] name:args[@"name"] appName:args[@"appName"] completion:completion];
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

- (void)createDirectory:(NSString *)directory uid:(NSNumber *)uid gid:(NSNumber *)gid permissions:(NSNumber *)permissions excludeFromBackup:(BOOL)excludeFromBackup completion:(void (^)(NSError *error, id value))completion {
  NSMutableDictionary *attributes = [NSMutableDictionary dictionary];
  attributes[NSFilePosixPermissions] = permissions;
  attributes[NSFileOwnerAccountID] = uid;
  attributes[NSFileGroupOwnerAccountID] = gid;

  NSError *error = nil;
  if (![NSFileManager.defaultManager createDirectoryAtPath:directory withIntermediateDirectories:YES attributes:attributes error:&error]) {
    completion(error, nil);
    return;
  }

  if (excludeFromBackup) {
    NSURL *directoryURL = [NSURL fileURLWithPath:directory];
    OSStatus status = CSBackupSetItemExcluded((__bridge CFURLRef)directoryURL, YES, YES);
    if (status != noErr) {
      completion(KBMakeError(status, @"Error trying to exclude from backup"), nil);
      return;
    }
  }

  completion(nil, @{});
}

- (BOOL)linkExists:(NSString *)linkPath {
  NSDictionary *attributes = [NSFileManager.defaultManager attributesOfItemAtPath:linkPath error:nil];
  if (!attributes) {
    return NO;
  }
  return [attributes[NSFileType] isEqual:NSFileTypeSymbolicLink];
}

- (NSString *)resolveLinkPath:(NSString *)linkPath {
  if (![self linkExists:linkPath]) {
    return nil;
  }
  return [NSFileManager.defaultManager destinationOfSymbolicLinkAtPath:linkPath error:nil];
}

- (BOOL)createLink:(NSString *)path linkPath:(NSString *)linkPath uid:(uid_t)uid gid:(gid_t)gid {
  if ([self linkExists:linkPath]) {
    [NSFileManager.defaultManager removeItemAtPath:linkPath error:nil];
  }
  if ([NSFileManager.defaultManager createSymbolicLinkAtPath:linkPath withDestinationPath:path error:nil]) {
    // setAttributes doesn't work with symlinks, so we have to call lchown() directly
    const char *file = [NSFileManager.defaultManager fileSystemRepresentationWithPath:linkPath];
    if (lchown(file, uid, gid) == 0) {
      return YES;
    }
  }
  return NO;
}

- (void)addToPath:(NSString *)directory name:(NSString *)name appName:(NSString *)appName completion:(void (^)(NSError *error, id value))completion {
  NSString *path = [NSString stringWithFormat:@"%@/%@", directory, name];
  NSString *linkDir = @"/usr/local/bin";
  NSString *linkPath = [NSString stringWithFormat:@"%@/%@", linkDir, name];

  // Check if link dir exists and resolves correctly
  if ([NSFileManager.defaultManager fileExistsAtPath:linkDir]) {
    NSString *resolved = [self resolveLinkPath:linkPath];
    // Check if we're linked properly at /usr/local/bin
    if ([resolved isEqualToString:path]) {
      completion(nil, @{@"path": linkPath});
      return;
    }

    // Fix the link
    NSDictionary *dirAttributes = [NSFileManager.defaultManager attributesOfItemAtPath:linkDir error:nil];
    uid_t uid = [dirAttributes[NSFileOwnerAccountID] intValue];
    gid_t gid = [dirAttributes[NSFileGroupOwnerAccountID] intValue];
    KBLog(@"Fixing symlink: %@, %@ (%@,%@)", linkPath, path, @(uid), @(gid));
    if (dirAttributes && [self createLink:path linkPath:linkPath uid:uid gid:gid]) {
      completion(nil, @{@"path": linkPath});
      return;
    }
  }

  // Fall back to using /etc/paths.d/
  NSString *pathsdPath = [NSString stringWithFormat:@"/etc/paths.d/%@", appName];
  if ([NSFileManager.defaultManager fileExistsAtPath:pathsdPath]) {
    completion(nil, nil);
    return;
  }
  NSError *error = nil;
  [directory writeToFile:pathsdPath atomically:YES encoding:NSUTF8StringEncoding error:&error];
  completion(error, @{@"path": pathsdPath});
}

- (void)removeFromPath:(NSString *)directory name:(NSString *)name appName:(NSString *)appName completion:(void (^)(NSError *error, id value))completion {
  NSString *path = [NSString stringWithFormat:@"%@/%@", directory, name];
  NSString *linkPath = [NSString stringWithFormat:@"/usr/local/bin/%@", name];
  NSString *resolved = [self resolveLinkPath:linkPath];
  NSMutableArray *removePaths = [NSMutableArray array];

  if ([resolved isEqualToString:path]) {
    [removePaths addObject:linkPath];
  }

  NSString *pathsdPath = [NSString stringWithFormat:@"/etc/paths.d/%@", appName];
  if ([NSFileManager.defaultManager fileExistsAtPath:pathsdPath]) {
    [removePaths addObject:pathsdPath];
  }

  NSMutableArray *errors = [NSMutableArray array];
  for (NSString *path in removePaths) {
    NSError *error = nil;
    if (![NSFileManager.defaultManager removeItemAtPath:path error:&error]) {
      [errors addObject:KBMakeError(error.code, @"Failed to remove path: %@", path)];
    }
  }

  if ([errors count] > 0) {
    completion(KBMakeError(-1, @"%@", [errors componentsJoinedByString:@". "]), @{@"paths": removePaths});
  } else {
    completion(nil, @{@"paths": removePaths});
  }
}

- (void)moveFromSource:(NSString *)source destination:(NSString *)destination overwriteDestination:(BOOL)overwriteDestination completion:(void (^)(NSError *error, id value))completion {
  NSError *error = nil;
  if ([NSFileManager.defaultManager fileExistsAtPath:destination isDirectory:NULL] && ![NSFileManager.defaultManager removeItemAtPath:destination error:&error]) {
    completion(error, nil);
    return;
  }

  if (![NSFileManager.defaultManager moveItemAtPath:source toPath:destination error:&error]) {
    completion(error, nil);
    return;
  }

  completion(nil, @{});
}

- (void)remove:(NSString *)path completion:(void (^)(NSError *error, id value))completion {
  NSError *error = nil;
  // The caller will check the path too but let's be safer and prevent some bad paths
  if (!path || ![path hasPrefix:@"/"] || [path isEqualToString:@"/"]) {
    completion(KBMakeError(MPXPCErrorCodeInvalidRequest, @"Invalid path"), nil);
    return;
  }

  if (![NSFileManager.defaultManager removeItemAtURL:[NSURL fileURLWithPath:path] error:&error]) {
    completion(error, nil);
    return;
  }
  completion(nil, @{});
}

@end
