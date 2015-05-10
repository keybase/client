//
//  KBCLIInstall.m
//  Keybase
//
//  Created by Gabriel on 5/10/15.
//  Copyright (c) 2015 Gabriel Handford. All rights reserved.
//

#import "KBCLIInstall.h"
#import "KBDefines.h"

@implementation KBCLIInstall

- (NSString *)info {
  return @"CLI";
}

- (void)installStatus:(KBInstallStatus)completion {
  // This will follow the symlink (to check if symlink exists you'd have to look for attributesOfItemAtPath:)
  if ([NSFileManager.defaultManager fileExistsAtPath:@"/usr/local/bin/keybase" isDirectory:nil]) {
    completion(nil, YES);
  } else {
    completion(nil, NO);
  }
}

- (void)install:(void (^)(NSError *error, BOOL installed))completion {
  NSError *error = nil;
  if (![NSFileManager.defaultManager createSymbolicLinkAtPath:@"/usr/local/bin/keybase" withDestinationPath:@"/Applications/Keybase.app/Contents/MacOS/Keybase" error:&error]) {
    if (!error) error = KBMakeError(-1, @"Unable to create keybase symlink");
    completion(error, NO);
  } else {
    completion(nil, YES);
  }
}

@end
