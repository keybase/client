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
@property BOOL installing;
@end

@implementation KBFSInstaller

- (BOOL)install:(NSString *)path error:(NSError **)error {
  if (_installing) {
    if (error) *error = KBMakeError(-1001, @"Install in progress");
    return NO;
  }

  // Remove bundle (which was for packaging only)
  if ([[path lastPathComponent] isEqualToString:@"bundle"]) {
    path = [path stringByDeletingLastPathComponent];
  }

  KBLog(@"Install: %@", path);

  NSString *filename = [path lastPathComponent];
  NSString *destination = [@"/Library/Filesystems/" stringByAppendingPathComponent:filename];

  if ([NSFileManager.defaultManager isReadableFileAtPath:path]) {
    if (![NSFileManager.defaultManager copyItemAtPath:path toPath:destination error:error]) {
      return NO;
    }
  }

  NSDictionary *fileAttributes = [NSFileManager.defaultManager attributesOfItemAtPath:destination error:NULL];
  NSMutableDictionary *attributes = [NSMutableDictionary dictionaryWithDictionary:fileAttributes];
  attributes[NSFilePosixPermissions] = [NSNumber numberWithShort:0755];
  attributes[NSFileOwnerAccountID] = @(0);
  attributes[NSFileGroupOwnerAccountID] = @(0);

  NSDirectoryEnumerator *dirEnum = [NSFileManager.defaultManager enumeratorAtPath:destination];
  NSString *file;
  while ((file = [dirEnum nextObject])) {
    if (![NSFileManager.defaultManager setAttributes:attributes ofItemAtPath:[destination stringByAppendingPathComponent:file] error:error]) {
      return NO;
    }
  }

  NSString *kext = [destination stringByAppendingPathComponent:@"/Support/osxfusefs.kext"];
  OSReturn status = KextManagerLoadKextWithURL((__bridge CFURLRef)([NSURL fileURLWithPath:kext]), NULL);
  //OSReturn status = KextManagerLoadKextWithIdentifier(CFSTR("com.github.osxfuse.filesystems.osxfusefs"), NULL);
  if (status != kOSReturnSuccess) {
    if (error) *error = KBMakeError(KBErrorCodeInstaller, @"KextManager failed to load with status: %@", @(status));
    return NO;
  }

  return YES;
}

@end
