//
//  KBFS.m
//  Keybase
//
//  Created by Gabriel on 4/21/15.
//  Copyright (c) 2015 Gabriel Handford. All rights reserved.
//

#import "KBFS.h"

#import <IOKit/kext/KextManager.h>

@interface KBFS ()
@property NSString *path;
@end

@implementation KBFS

- (NSDictionary *)kextInfo:(NSString *)label {
  NSDictionary *kexts = (__bridge NSDictionary *)KextManagerCopyLoadedKextInfo((__bridge CFArrayRef)@[label], NULL);
  return kexts[label];
}

- (BOOL)isKextLoaded:(NSString *)label {
  NSDictionary *kexts = (__bridge NSDictionary *)KextManagerCopyLoadedKextInfo((__bridge CFArrayRef)@[label], (__bridge CFArrayRef)@[@"OSBundleStarted"]);
  return [kexts[label][@"OSBundleStarted"] boolValue];
}

- (void)installOrUpdateWithSource:(NSString *)source destination:(NSString *)destination kextID:(NSString *)kextID completion:(KBOnCompletion)completion {
  if ([NSFileManager.defaultManager fileExistsAtPath:destination isDirectory:NULL]) {
    completion(KBMakeError(KBHelperErrorKBFS, @"Update is currently unsupported."), @(0));
  } else {
    [self installWithSource:source destination:destination kextID:kextID completion:completion];
  }
}

- (void)installWithSource:(NSString *)source destination:(NSString *)destination kextID:(NSString *)kextID completion:(KBOnCompletion)completion {
  KBLog(@"Install: %@ to %@", source, destination);

  NSError *error = nil;
  if (![NSFileManager.defaultManager copyItemAtPath:source toPath:destination error:&error]) {
    if (!error) error = KBMakeError(KBHelperErrorKBFS, @"Failed to copy");
    completion(error, @(0));
    return;
  }

  NSDictionary *fileAttributes = [NSFileManager.defaultManager attributesOfItemAtPath:destination error:NULL];
  NSMutableDictionary *attributes = [NSMutableDictionary dictionaryWithDictionary:fileAttributes];
  attributes[NSFilePosixPermissions] = [NSNumber numberWithShort:0755];
  attributes[NSFileOwnerAccountID] = @(0);
  attributes[NSFileGroupOwnerAccountID] = @(0);

  [self updateAttributes:attributes path:destination completion:^(NSError *error) {
    if (error) completion(error, @(0));
    else [self loadKextID:kextID path:destination completion:completion];
  }];
}

- (void)updateAttributes:(NSDictionary *)attributes path:(NSString *)path completion:(KBCompletion)completion {
  NSError *error = nil;
  if (![NSFileManager.defaultManager setAttributes:attributes ofItemAtPath:path error:&error]) {
    if (!error) error = KBMakeError(KBHelperErrorKBFS, @"Failed to set attributes");
    completion(error);
    return;
  }

  NSDirectoryEnumerator *dirEnum = [NSFileManager.defaultManager enumeratorAtPath:path];
  NSString *file;
  while ((file = [dirEnum nextObject])) {
    if (![NSFileManager.defaultManager setAttributes:attributes ofItemAtPath:[path stringByAppendingPathComponent:file] error:&error]) {
      if (!error) error = KBMakeError(KBHelperErrorKBFS, @"Failed to set attributes");
      completion(error);
      return;
    }
  }

  completion(nil);
}

- (void)updateWithSource:(NSString *)source destination:(NSString *)destination kextID:(NSString *)kextID completion:(KBOnCompletion)completion {
  [self uninstallWithDestination:destination kextID:kextID completion:^(NSError *error, id value) {
    if (error) {
      completion(error, @(0));
      return;
    }
    [self installWithSource:source destination:destination kextID:kextID completion:completion];
  }];
}

- (void)loadKextID:(NSString *)kextID path:(NSString *)path completion:(KBOnCompletion)completion {
  OSReturn status = KextManagerLoadKextWithIdentifier((__bridge CFStringRef)(kextID), (__bridge CFArrayRef)@[[NSURL fileURLWithPath:path]]);
  if (status != kOSReturnSuccess) {
    NSError *error = KBMakeError(KBHelperErrorKBFS, @"KextManager failed to load with status: %@", @(status));
    completion(error, @(0));
  } else {
    completion(nil, @(1));
  }
}

- (void)unloadWithKextLabel:(NSString *)kextID completion:(KBOnCompletion)completion {
  NSError *error = nil;
  BOOL unloaded = [self unloadKextWithLabel:kextID error:&error];
  completion(error, @(unloaded));
}

- (BOOL)unloadKextWithLabel:(NSString *)label error:(NSError **)error {
  OSReturn status = KextManagerUnloadKextWithIdentifier((__bridge CFStringRef)label);
  if (status != kOSReturnSuccess) {
    if (error) *error = KBMakeError(KBHelperErrorKBFS, @"KextManager failed to unload with status: %@: %@", @(status), [self descriptionForStatus:status]);
    return NO;
  }
  return YES;
}

- (void)uninstallWithDestination:(NSString *)destination kextID:(NSString *)kextID completion:(KBOnCompletion)completion {
  if ([self isKextLoaded:kextID]) {
    NSError *error = nil;
    if (![self unloadKextWithLabel:kextID error:&error]) {
      completion(error, @(NO));
      return;
    }
  } else {
    // Do an unload to be safe (in case isKextLoaded lied)
    KextManagerUnloadKextWithIdentifier((__bridge CFStringRef)kextID);
  }

  NSError *error = nil;
  if ([NSFileManager.defaultManager fileExistsAtPath:destination isDirectory:NULL] && ![NSFileManager.defaultManager removeItemAtPath:destination error:&error]) {
    if (!error) error = KBMakeError(KBHelperErrorKBFS, @"Failed to uninstall");
    completion(error, @(0));
  } else {
    completion(nil, @(1));
  }
}

- (NSString *)descriptionForStatus:(OSReturn)status {
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
