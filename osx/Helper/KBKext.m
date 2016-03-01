//
//  KBKext.m
//  Keybase
//
//  Created by Gabriel on 4/21/15.
//  Copyright (c) 2015 Gabriel Handford. All rights reserved.
//

#import "KBKext.h"

#import <IOKit/kext/KextManager.h>

@implementation KBKext

+ (NSDictionary *)kextInfo:(NSString *)label {
  NSDictionary *kexts = (__bridge NSDictionary *)KextManagerCopyLoadedKextInfo((__bridge CFArrayRef)@[label], NULL);
  return kexts[label];
}

+ (BOOL)isKextLoaded:(NSString *)label {
  NSDictionary *kexts = (__bridge NSDictionary *)KextManagerCopyLoadedKextInfo((__bridge CFArrayRef)@[label], (__bridge CFArrayRef)@[@"OSBundleStarted"]);
  return [kexts[label][@"OSBundleStarted"] boolValue];
}

+ (void)installWithSource:(NSString *)source destination:(NSString *)destination kextID:(NSString *)kextID kextPath:(NSString *)kextPath completion:(KBOnCompletion)completion {
  NSError *error = nil;

  // Uninstall if installed
  if (![self uninstallWithDestination:destination kextID:kextID error:&error]) {
    if (!error) error = KBMakeError(KBHelperErrorKext, @"Failed to uninstall");
    completion(error, @(0));
    return;
  }

  // Copy kext into place
  [self copyWithSource:source destination:destination removeExisting:NO completion:^(NSError *error, id value) {
    if (error) {
      completion(error, nil);
      return;
    }
    [self loadKextID:kextID path:kextPath completion:completion];
  }];
}

+ (void)copyWithSource:(NSString *)source destination:(NSString *)destination removeExisting:(BOOL)removeExisting completion:(KBOnCompletion)completion {
  NSError *error = nil;

  if (removeExisting && ![self deletePath:destination error:&error]) {
    if (!error) error = KBMakeError(KBHelperErrorKext, @"Failed to remove existing");
    completion(error, nil);
    return;
  }

  if (![NSFileManager.defaultManager copyItemAtPath:source toPath:destination error:&error]) {
    if (!error) error = KBMakeError(KBHelperErrorKext, @"Failed to copy");
    completion(error, nil);
    return;
  }

  NSDictionary *fileAttributes = [NSFileManager.defaultManager attributesOfItemAtPath:destination error:NULL];
  NSMutableDictionary *attributes = [NSMutableDictionary dictionaryWithDictionary:fileAttributes];
  attributes[NSFilePosixPermissions] = [NSNumber numberWithShort:0755];
  attributes[NSFileOwnerAccountID] = @(0);
  attributes[NSFileGroupOwnerAccountID] = @(0);

  [self updateAttributes:attributes path:destination completion:^(NSError *error) {
    if (error) {
      completion(error, nil);
      return;
    }
    if (![self updateLoaderFileAttributes:destination error:&error]) {
      completion(error, nil);
      return;
    }
    completion(nil, nil);
  }];
}

+ (BOOL)updateLoaderFileAttributes:(NSString *)destination error:(NSError **)error {
  NSString *path = [NSString stringWithFormat:@"%@/Contents/Resources/load_kbfuse", destination];
  NSDictionary *fileAttributes = [NSFileManager.defaultManager attributesOfItemAtPath:path error:error];
  if (!fileAttributes) {
    return NO;
  }
  NSMutableDictionary *attributes = [NSMutableDictionary dictionaryWithDictionary:fileAttributes];
  attributes[NSFilePosixPermissions] = [NSNumber numberWithShort:04755];
  attributes[NSFileOwnerAccountID] = @(0);
  attributes[NSFileGroupOwnerAccountID] = @(0);
  return [NSFileManager.defaultManager setAttributes:attributes ofItemAtPath:path error:error];
}

+ (void)updateAttributes:(NSDictionary *)attributes path:(NSString *)path completion:(KBCompletion)completion {
  NSError *error = nil;
  if (![self updateAttributes:attributes path:path error:&error]) {
    if (!error) error = KBMakeError(KBHelperErrorKext, @"Failed to set attributes");
    completion(error);
    return;
  }

  NSDirectoryEnumerator *enumerator = [NSFileManager.defaultManager enumeratorAtPath:path];
  NSString *file;
  while ((file = [enumerator nextObject])) {
    if (![self updateAttributes:attributes path:[path stringByAppendingPathComponent:file] error:&error]) {
      if (!error) error = KBMakeError(KBHelperErrorKext, @"Failed to set attributes");
      completion(error);
      return;
    }
  }

  completion(nil);
}

+ (BOOL)updateAttributes:(NSDictionary *)attributes path:(NSString *)path error:(NSError **)error {
  NSDictionary *existingAttributes = [NSFileManager.defaultManager attributesOfItemAtPath:path error:error];
  if (!existingAttributes) {
    return NO;
  }

  // setAttributes doesn't work on symbolic links
  if (existingAttributes[NSFileType] == NSFileTypeSymbolicLink) {
    const char *file = [NSFileManager.defaultManager fileSystemRepresentationWithPath:path];
    uid_t uid = [attributes[NSFileOwnerAccountID] intValue];
    gid_t gid = [attributes[NSFileGroupOwnerAccountID] intValue];
    int res = lchown(file, uid, gid);
    if (res != 0) {
      if (error) *error = KBMakeError(KBHelperErrorKext, @"Unable to set attributes on symlink: %@", @(res));
      return NO;
    }
    return YES;
  }

  if (![NSFileManager.defaultManager setAttributes:attributes ofItemAtPath:path error:error]) {
    return NO;
  }

  return YES;
}

+ (void)updateWithSource:(NSString *)source destination:(NSString *)destination kextID:(NSString *)kextID kextPath:(NSString *)kextPath completion:(KBOnCompletion)completion {
  [self uninstallWithDestination:destination kextID:kextID completion:^(NSError *error, id value) {
    if (error) {
      completion(error, @(0));
      return;
    }
    [self installWithSource:source destination:destination kextID:kextID kextPath:kextPath completion:completion];
  }];
}

+ (void)loadKextID:(NSString *)kextID path:(NSString *)path completion:(KBOnCompletion)completion {
  KBLog(@"Loading kextID: %@ (%@)", kextID, path);
  OSReturn status = KextManagerLoadKextWithIdentifier((__bridge CFStringRef)(kextID), (__bridge CFArrayRef)@[[NSURL fileURLWithPath:path]]);
  if (status != kOSReturnSuccess) {
    NSError *error = KBMakeError(KBHelperErrorKext, @"KextManager failed to load with status: %@", @(status));
    completion(error, nil);
  } else {
    completion(nil, nil);
  }
}

+ (void)unloadKextID:(NSString *)kextID completion:(KBOnCompletion)completion {
  NSParameterAssert(kextID);
  KBLog(@"Unload kextID: %@ (%@)", kextID);
  NSError *error = nil;
  [self unloadKextID:kextID error:&error];
  completion(error, nil);
}

+ (BOOL)unloadKextID:(NSString *)kextID error:(NSError **)error {
  BOOL isKextLoaded = [self isKextLoaded:kextID];
  KBLog(@"Kext loaded? %@", @(isKextLoaded));
  if (!isKextLoaded) return YES;

  return [self _unloadKextID:kextID error:error];
}

+ (BOOL)_unloadKextID:(NSString *)kextID error:(NSError **)error {
  KBLog(@"Unloading kextID: %@", kextID);
  OSReturn status = KextManagerUnloadKextWithIdentifier((__bridge CFStringRef)kextID);
  KBLog(@"Unload kext status: %@", @(status));
  if (status != kOSReturnSuccess) {
    if (error) *error = KBMakeError(KBHelperErrorKext, @"KextManager failed to unload with status: %@: %@", @(status), [KBKext descriptionForStatus:status]);
    return NO;
  }
  return YES;
}

+ (void)uninstallWithDestination:(NSString *)destination kextID:(NSString *)kextID completion:(KBOnCompletion)completion {
  NSError *error = nil;
  if (![self uninstallWithDestination:destination kextID:kextID error:&error]) {
    completion(error, @(0));
    return;
  }
  completion(nil, @(0));
}

+ (BOOL)deletePath:(NSString *)path error:(NSError **)error {
  if ([NSFileManager.defaultManager fileExistsAtPath:path isDirectory:NULL] && ![NSFileManager.defaultManager removeItemAtPath:path error:error]) {
    if (error) *error = KBMakeError(KBHelperErrorKext, @"Failed to remove path: %@", path);
    return NO;
  }
  return YES;
}

+ (BOOL)uninstallWithDestination:(NSString *)destination kextID:(NSString *)kextID error:(NSError **)error {
  if (![self unloadKextID:kextID error:error]) {
    return NO;
  }

  if (![self deletePath:destination error:error]) {
    return NO;
  }

  return YES;
}

+ (NSString *)descriptionForStatus:(OSReturn)status {
  switch (status) {
    case kOSMetaClassDuplicateClass:
      return @"A duplicate Libkern C++ classname was encountered during kext loading.";
    case kOSMetaClassHasInstances:
      return @"A kext cannot be unloaded because there are instances derived from Libkern C++ classes that it defines.";
    case kOSMetaClassInstNoSuper:
      return @"Internal error: No superclass can be found when constructing an instance of a Libkern C++ class.";
    case kOSMetaClassInternal:
      return @"Internal OSMetaClass run-time error.";
    case kOSMetaClassNoDicts:
      return @"Internal error: An allocation failure occurred registering Libkern C++ classes during kext loading.";
    case kOSMetaClassNoInit:
      return @"Internal error: The Libkern C++ class registration system was not properly initialized during kext loading.";
    case kOSMetaClassNoInsKModSet:
      return @"Internal error: An error occurred registering a specific Libkern C++ class during kext loading.";
    case kOSMetaClassNoKext:
      return @"Internal error: The kext for a Libkern C++ class can't be found during kext loading.";
    case kOSMetaClassNoKModSet:
      return @"Internal error: An allocation failure occurred registering Libkern C++ classes during kext loading.";
    case kOSMetaClassNoSuper:
      return @"Internal error: No superclass can be found for a specific Libkern C++ class during kext loading.";
    case kOSMetaClassNoTempData:
      return @"Internal error: An allocation failure occurred registering Libkern C++ classes during kext loading.";
    case kOSReturnError:
      return @"Unspecified Libkern error. Not equal to KERN_FAILURE.";
    case kOSReturnSuccess:
      return @"Operation successful. Equal to KERN_SUCCESS.";
    case -603947004:
      return @"Root privileges required.";
    case -603947002:
      return @"Kext not loaded.";
    default:
      return @"Unknown error unloading kext.";
  }
}

@end
