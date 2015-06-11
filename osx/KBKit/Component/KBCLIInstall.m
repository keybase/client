//
//  KBCLIInstall.m
//  Keybase
//
//  Created by Gabriel on 5/10/15.
//  Copyright (c) 2015 Gabriel Handford. All rights reserved.
//

#import "KBCLIInstall.h"
#import "KBInfoView.h"
#import "KBIcons.h"
#import "KBDefines.h"

#import <MPMessagePack/MPXPCClient.h>

@interface KBCLIInstall ()
@property KBInfoView *infoView;
@end

@implementation KBCLIInstall

- (NSString *)name {
  return @"Command Line";
}

- (NSString *)info {
  return @"For power users, like you";
}

- (NSImage *)image {
  return [KBIcons imageForIcon:KBIconExecutableBinary];
}

- (NSView *)componentView {
  [self componentDidUpdate];
  return _infoView;
}

- (void)componentDidUpdate {
  GHODictionary *info = [GHODictionary dictionary];

  GHODictionary *statusInfo = [self componentStatusInfo];
  if (statusInfo) [info addEntriesFromOrderedDictionary:statusInfo];

  if (!_infoView) _infoView = [[KBInfoView alloc] init];
  [_infoView setProperties:info];
}

- (void)updateComponentStatus:(KBCompletion)completion {
  NSError *error = nil;
  NSString *destination = [NSFileManager.defaultManager destinationOfSymbolicLinkAtPath:LINK_SOURCE error:&error];
  if (error) {
    self.componentStatus = [KBComponentStatus componentStatusWithInstallStatus:KBInstallStatusNotInstalled runtimeStatus:KBRuntimeStatusNone info:nil];
    completion(nil);
    //self.componentStatus = [KBComponentStatus componentStatusWithError:error];
    //completion(error);
    return;
  }

  NSString *linkSource = @"/usr/local/bin";
  NSString *linkDestination = NSStringWithFormat(@"%@/bin/keybase", self.config.bundle.sharedSupportPath);

  // This will follow the symlink (to check if symlink exists you'd have to look for attributesOfItemAtPath:)
  if ([NSFileManager.defaultManager fileExistsAtPath:linkSource isDirectory:nil]) {
    if ([destination isEqualToString:linkDestination]) {
      self.componentStatus = [KBComponentStatus componentStatusWithInstallStatus:KBInstallStatusInstalled runtimeStatus:KBRuntimeStatusNone info:nil];
      completion(nil);
    } else {
      self.componentStatus = [KBComponentStatus componentStatusWithInstallStatus:KBInstallStatusNeedsUpgrade runtimeStatus:KBRuntimeStatusNone info:nil];
      completion(nil);
    }
  } else {
    self.componentStatus = [KBComponentStatus componentStatusWithInstallStatus:KBInstallStatusNotInstalled runtimeStatus:KBRuntimeStatusNone info:nil];
    completion(nil);
  }
}

- (void)install:(KBCompletion)completion {
  NSString *linkDestination = NSStringWithFormat(@"%@/bin/keybase", self.config.bundle.sharedSupportPath);

  MPXPCClient *helper = [[MPXPCClient alloc] initWithServiceName:@"keybase.Helper" privileged:YES];
  [helper sendRequest:@"cli_install" params:@[@{@"path": linkDestination}] completion:^(NSError *error, id value) {
    completion(error);
  }];
}

- (void)uninstall:(KBCompletion)completion {
  NSError *error = nil;
  [NSFileManager.defaultManager removeItemAtPath:LINK_SOURCE error:&error];
  completion(error);
}

- (void)start:(KBCompletion)completion {
  completion(KBMakeError(-1, @"Unsupported"));
}

- (void)stop:(KBCompletion)completion {
  completion(KBMakeError(-1, @"Unsupported"));
}

@end
