//
//  KBFS.m
//  Keybase
//
//  Created by Gabriel on 4/21/15.
//  Copyright (c) 2015 Gabriel Handford. All rights reserved.
//

#import "KBFS.h"

#import "KBHelperDefines.h"
#import <IOKit/kext/KextManager.h>

@interface KBFS ()
@property NSString *path;
@property NSString *source;
@property NSString *destination;
@property NSString *kext;
@end

@implementation KBFS

- (instancetype)initWithPath:(NSString *)path {
  if ((self = [super init])) {
    _source = path;

    if ([[path pathExtension] isEqualToString:@"bundle"]) {
      path = [path stringByDeletingPathExtension]; // Remove .bundle (which was for packaging only)
    }
    _destination = KBNSStringWithFormat(@"/Library/Filesystems/%@", [path lastPathComponent]);

    _kext = KBNSStringWithFormat(@"%@/Support/osxfusefs.kext", _destination);
  }
  return self;
}

- (NSString *)sourceVersion {
  NSDictionary *plist = [NSDictionary dictionaryWithContentsOfFile:KBNSStringWithFormat(@"%@/Contents/Info.plist", _source)];
  if (!plist) return nil;
  return plist[@"CFBundleShortVersionString"];
}

- (NSString *)destinationVersion {
  NSDictionary *plist = [NSDictionary dictionaryWithContentsOfFile:KBNSStringWithFormat(@"%@/Contents/Info.plist", _destination)];
  if (!plist) return nil;
  return plist[@"CFBundleShortVersionString"];
}

- (void)status:(KBOnCompletion)completion {
  if ([self.sourceVersion isEqualTo:self.destinationVersion]) {
    completion(nil, @"ok");
  } else if (![NSFileManager.defaultManager fileExistsAtPath:_destination isDirectory:NULL]) {
    completion(nil, @"needs_update");
  } else {
    completion(nil, @"needs_install");
  }
}

- (void)load:(KBOnCompletion)completion {
  if ([self.sourceVersion isEqualTo:self.destinationVersion]) {
    [self loadKext:completion];
  } else {
    [self installOrUpdate:completion];
  }
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

  NSDirectoryEnumerator *dirEnum = [NSFileManager.defaultManager enumeratorAtPath:_destination];
  NSString *file;
  while ((file = [dirEnum nextObject])) {
    if (![NSFileManager.defaultManager setAttributes:attributes ofItemAtPath:[_destination stringByAppendingPathComponent:file] error:&error]) {
      if (!error) error = KBMakeError(KBHelperErrorKBFS, @"Failed to set attributes");
      completion(error, @(0));
      return;
    }
  }

  [self loadKext:completion];
}

- (void)update:(KBOnCompletion)completion {
  [self uninstall:^(NSError *error, id value) {
    if (error) completion(error, @(0));
    else [self install:completion];
  }];
}

- (void)loadKext:(KBOnCompletion)completion {
  OSReturn status = KextManagerLoadKextWithURL((__bridge CFURLRef)([NSURL fileURLWithPath:_kext]), NULL);
  //OSReturn status = KextManagerLoadKextWithIdentifier(CFSTR("com.github.osxfuse.filesystems.osxfusefs"), NULL);
  if (status != kOSReturnSuccess) {
    NSError *error = KBMakeError(KBHelperErrorKBFS, @"KextManager failed to load with status: %@", @(status));
    completion(error, @(0));
  } else {
    completion(nil, @(1));
  }
}

- (void)unload:(KBOnCompletion)completion {
  OSReturn status = KextManagerUnloadKextWithIdentifier(CFSTR("com.github.osxfuse.filesystems.osxfusefs"));
  if (status != kOSReturnSuccess) {
    NSError *error = KBMakeError(KBHelperErrorKBFS, @"KextManager failed to unload with status: %@", @(status));
    completion(error, @(0));
  } else {
    completion(nil, @(1));
  }
}

- (void)uninstall:(KBOnCompletion)completion {
  KextManagerUnloadKextWithIdentifier(CFSTR("com.github.osxfuse.filesystems.osxfusefs"));

  NSError *error = nil;
  if ([NSFileManager.defaultManager fileExistsAtPath:_destination isDirectory:NULL] && ![NSFileManager.defaultManager removeItemAtPath:_destination error:&error]) {
    if (!error) error = KBMakeError(KBHelperErrorKBFS, @"Failed to uninstall");
    completion(error, @(0));
  } else {
    completion(nil, @(1));
  }
}

@end
