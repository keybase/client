//
//  KBFSInstaller.m
//  Keybase
//
//  Created by Gabriel on 4/21/15.
//  Copyright (c) 2015 Gabriel Handford. All rights reserved.
//

#import "KBFSInstaller.h"

#import "KBHelperDefines.h"
#import <IOKit/kext/KextManager.h>
#import "KBHLog.h"

@interface KBFSInstaller ()
@property NSString *path;
@property NSString *source;
@property NSString *destination;

@property BOOL installing;
@end

@implementation KBFSInstaller

- (instancetype)initWithPath:(NSString *)path {
  if ((self = [super init])) {
    _source = path;

    if ([[path pathExtension] isEqualToString:@"bundle"]) {
      path = [path stringByDeletingPathExtension]; // Remove .bundle (which was for packaging only)
    }
    _destination = KBNSStringWithFormat(@"/Library/Filesystems/%@", [path lastPathComponent]);
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

- (BOOL)install:(NSError **)error {
  if (_installing) {
    if (error) *error = KBMakeError(-1001, @"Install in progress");
    return NO;
  }

  KBLog(@"Install: %@ to %@", _source, _destination);

  if (![NSFileManager.defaultManager copyItemAtPath:_source toPath:_destination error:error]) {
    return NO;
  }

  NSDictionary *fileAttributes = [NSFileManager.defaultManager attributesOfItemAtPath:_destination error:NULL];
  NSMutableDictionary *attributes = [NSMutableDictionary dictionaryWithDictionary:fileAttributes];
  attributes[NSFilePosixPermissions] = [NSNumber numberWithShort:0755];
  attributes[NSFileOwnerAccountID] = @(0);
  attributes[NSFileGroupOwnerAccountID] = @(0);

  NSDirectoryEnumerator *dirEnum = [NSFileManager.defaultManager enumeratorAtPath:_destination];
  NSString *file;
  while ((file = [dirEnum nextObject])) {
    if (![NSFileManager.defaultManager setAttributes:attributes ofItemAtPath:[_destination stringByAppendingPathComponent:file] error:error]) {
      return NO;
    }
  }

  NSString *kext = KBNSStringWithFormat(@"%@/Support/osxfusefs.kext", _destination);
  OSReturn status = KextManagerLoadKextWithURL((__bridge CFURLRef)([NSURL fileURLWithPath:kext]), NULL);
  //OSReturn status = KextManagerLoadKextWithIdentifier(CFSTR("com.github.osxfuse.filesystems.osxfusefs"), NULL);
  if (status != kOSReturnSuccess) {
    if (error) *error = KBMakeError(KBErrorCodeInstaller, @"KextManager failed to load with status: %@", @(status));
    return NO;
  }

  return YES;
}

@end
