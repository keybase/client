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
@property NSString *source;
@property NSString *destination;
@property NSString *kext;
@end

@implementation KBFS

- (instancetype)init {
  if ((self = [super init])) {
    _source = @"/Applications/Keybase.app/Contents/Resources/osxfusefs.bundle";
    _destination = KBFUSE_BUNDLE;
    _kext = KBNSStringWithFormat(@"%@/Support/osxfusefs.kext", _destination);
  }
  return self;
}

- (NSString *)bundleVersion {
  NSDictionary *plist = [NSDictionary dictionaryWithContentsOfFile:KBNSStringWithFormat(@"%@/Contents/Info.plist", _source)];
  if (!plist) return nil;
  return plist[@"CFBundleShortVersionString"];
}

- (NSString *)installedVersion {
  NSDictionary *plist = [NSDictionary dictionaryWithContentsOfFile:KBNSStringWithFormat(@"%@/Contents/Info.plist", _destination)];
  if (!plist) return nil;
  return plist[@"CFBundleShortVersionString"];
}

- (NSString *)runningVersion {
  NSDictionary *kexts = (__bridge NSDictionary *)KextManagerCopyLoadedKextInfo((__bridge CFArrayRef)@[KEXT_LABEL], NULL);
  return kexts[KEXT_LABEL][@"CFBundleVersion"];
}

- (void)installOrUpdate:(KBOnCompletion)completion {
  if ([NSFileManager.defaultManager fileExistsAtPath:_destination isDirectory:NULL]) {
    [self update:completion];
  } else {
    [self install:completion];
  }
}

- (void)install:(KBOnCompletion)completion {
  KBLog(@"Install: %@ to %@", _source, _destination);

  NSError *error = nil;
  if (![NSFileManager.defaultManager copyItemAtPath:_source toPath:_destination error:&error]) {
    if (!error) error = KBMakeError(KBHelperErrorKBFS, @"Failed to copy");
    completion(error, @(0));
    return;
  }

  NSDictionary *fileAttributes = [NSFileManager.defaultManager attributesOfItemAtPath:_destination error:NULL];
  NSMutableDictionary *attributes = [NSMutableDictionary dictionaryWithDictionary:fileAttributes];
  attributes[NSFilePosixPermissions] = [NSNumber numberWithShort:0755];
  attributes[NSFileOwnerAccountID] = @(0);
  attributes[NSFileGroupOwnerAccountID] = @(0);

  [self updateAttributes:attributes path:_destination completion:^(NSError *error) {
    if (error) completion(error, @(0));
    else [self load:completion];
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

- (void)update:(KBOnCompletion)completion {
  [self uninstall:^(NSError *error, id value) {
    if (error) completion(error, @(0));
    else [self install:completion];
  }];
}

- (void)load:(KBOnCompletion)completion {
  OSReturn status = KextManagerLoadKextWithURL((__bridge CFURLRef)([NSURL fileURLWithPath:_kext]), NULL);
  if (status != kOSReturnSuccess) {
    NSError *error = KBMakeError(KBHelperErrorKBFS, @"KextManager failed to load with status: %@", @(status));
    completion(error, @(0));
  } else {
    completion(nil, @(1));
  }
}

- (void)unload:(KBOnCompletion)completion {
  OSReturn status = KextManagerUnloadKextWithIdentifier(KEXT_LABEL_CFSTR);
  if (status != kOSReturnSuccess) {
    NSError *error = KBMakeError(KBHelperErrorKBFS, @"KextManager failed to unload with status: %@", @(status));
    completion(error, @(0));
  } else {
    completion(nil, @(1));
  }
}

- (void)uninstall:(KBOnCompletion)completion {
  KextManagerUnloadKextWithIdentifier(KEXT_LABEL_CFSTR);

  NSError *error = nil;
  if ([NSFileManager.defaultManager fileExistsAtPath:_destination isDirectory:NULL] && ![NSFileManager.defaultManager removeItemAtPath:_destination error:&error]) {
    if (!error) error = KBMakeError(KBHelperErrorKBFS, @"Failed to uninstall");
    completion(error, @(0));
  } else {
    completion(nil, @(1));
  }
}

@end
