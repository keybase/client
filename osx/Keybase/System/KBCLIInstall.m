//
//  KBCLIInstall.m
//  Keybase
//
//  Created by Gabriel on 5/10/15.
//  Copyright (c) 2015 Gabriel Handford. All rights reserved.
//

#import "KBCLIInstall.h"
#import "KBAppDefines.h"
#import "KBAppKit.h"
#import <MPMessagePack/MPXPCClient.h>

@implementation KBCLIInstall

@synthesize status;

- (NSString *)name {
  return @"Command Line";
}

- (NSString *)info {
  return @"For power users, like you.";
}

- (NSImage *)image {
  return [KBIcons imageForIcon:KBIconExecutableBinary];
}

- (NSView *)contentView { return nil; }

- (void)status:(KBOnComponentStatus)completion {
  NSError *error = nil;
  NSString *destination = [NSFileManager.defaultManager destinationOfSymbolicLinkAtPath:LINK_SOURCE error:&error];
  if (error) {
    completion([KBComponentStatus componentStatusWithError:error]);
    return;
  }

  // This will follow the symlink (to check if symlink exists you'd have to look for attributesOfItemAtPath:)
  if ([NSFileManager.defaultManager fileExistsAtPath:LINK_SOURCE isDirectory:nil]) {
    if ([destination isEqualToString:LINK_DESTINATION]) {
      completion([KBComponentStatus componentStatusWithInstallStatus:KBInstallStatusInstalled runtimeStatus:KBRuntimeStatusNone info:nil]);
    } else {
      completion([KBComponentStatus componentStatusWithInstallStatus:KBInstallStatusNeedsUpgrade runtimeStatus:KBRuntimeStatusNone info:nil]);
    }
  } else {
    completion([KBComponentStatus componentStatusWithInstallStatus:KBInstallStatusNotInstalled runtimeStatus:KBRuntimeStatusNone info:nil]);
  }
}

- (void)install:(KBCompletion)completion {
  MPXPCClient *helper = [[MPXPCClient alloc] initWithServiceName:@"keybase.Helper" priviledged:YES];
  [helper sendRequest:@"cli_install" params:nil completion:^(NSError *error, id value) {
    completion(error);
  }];
}

@end
