//
//  KBCLIInstall.m
//  Keybase
//
//  Created by Gabriel on 5/10/15.
//  Copyright (c) 2015 Gabriel Handford. All rights reserved.
//

#import "KBCLIInstall.h"
#import "KBDefines.h"
#import <MPMessagePack/MPXPCClient.h>

@implementation KBCLIInstall

- (NSString *)info {
  return @"Command Line";
}

- (void)installStatus:(KBInstalledStatus)completion {
  NSError *error = nil;
  NSString *destination = [NSFileManager.defaultManager destinationOfSymbolicLinkAtPath:LINK_SOURCE error:&error];
  if (error) {
    completion(error, KBInstallStatusError, nil);
    return;
  }

  // This will follow the symlink (to check if symlink exists you'd have to look for attributesOfItemAtPath:)
  if ([NSFileManager.defaultManager fileExistsAtPath:LINK_SOURCE isDirectory:nil]) {
    if ([destination isEqualToString:LINK_DESTINATION]) {
      completion(nil, KBInstallStatusInstalled, nil);
    } else {
      completion(nil, KBInstallStatusNeedsUpgrade, nil);
    }
  } else {
    completion(nil, KBInstallStatusNotInstalled, nil);
  }
}

- (void)install:(KBInstalled)completion {
  MPXPCClient *helper = [[MPXPCClient alloc] initWithServiceName:@"keybase.Helper" priviledged:YES];
  [helper sendRequest:@"cli_install" params:nil completion:^(NSError *error, id value) {
    if (error) {
      completion(error, KBInstallStatusNotInstalled, nil);
    } else {
      completion(error, KBInstallStatusInstalled, nil);
    }
  }];
}

@end
