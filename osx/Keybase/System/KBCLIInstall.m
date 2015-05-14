//
//  KBCLIInstall.m
//  Keybase
//
//  Created by Gabriel on 5/10/15.
//  Copyright (c) 2015 Gabriel Handford. All rights reserved.
//

#import "KBCLIInstall.h"
#import "KBAppDefines.h"
#import <MPMessagePack/MPXPCClient.h>

@implementation KBCLIInstall

- (NSString *)name {
  return @"Command Line";
}

- (void)installStatus:(KBInstallableStatus)completion {
  NSError *error = nil;
  NSString *destination = [NSFileManager.defaultManager destinationOfSymbolicLinkAtPath:LINK_SOURCE error:&error];
  if (error) {
    completion([KBInstallStatus installStatusWithError:error]);
    return;
  }

  // This will follow the symlink (to check if symlink exists you'd have to look for attributesOfItemAtPath:)
  if ([NSFileManager.defaultManager fileExistsAtPath:LINK_SOURCE isDirectory:nil]) {
    if ([destination isEqualToString:LINK_DESTINATION]) {
      completion([KBInstallStatus installStatusWithStatus:KBInstalledStatusInstalled runtimeStatus:KBRuntimeStatusNone info:nil]);
    } else {
      completion([KBInstallStatus installStatusWithStatus:KBInstalledStatusNeedsUpgrade runtimeStatus:KBRuntimeStatusNone info:nil]);
    }
  } else {
    completion([KBInstallStatus installStatusWithStatus:KBInstalledStatusNotInstalled runtimeStatus:KBRuntimeStatusNone info:nil]);
  }
}

- (void)install:(KBCompletion)completion {
  MPXPCClient *helper = [[MPXPCClient alloc] initWithServiceName:@"keybase.Helper" priviledged:YES];
  [helper sendRequest:@"cli_install" params:nil completion:^(NSError *error, id value) {
    completion(error);
  }];
}

@end
