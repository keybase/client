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
#import "KBInfoView.h"

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

- (NSView *)contentView {
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

  // This will follow the symlink (to check if symlink exists you'd have to look for attributesOfItemAtPath:)
  if ([NSFileManager.defaultManager fileExistsAtPath:LINK_SOURCE isDirectory:nil]) {
    if ([destination isEqualToString:LINK_DESTINATION]) {
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
  MPXPCClient *helper = [[MPXPCClient alloc] initWithServiceName:@"keybase.Helper" priviledged:YES];
  [helper sendRequest:@"cli_install" params:nil completion:^(NSError *error, id value) {
    completion(error);
  }];
}

- (void)uninstall:(KBCompletion)completion {
  NSError *error = nil;
  [NSFileManager.defaultManager removeItemAtPath:LINK_SOURCE error:&error];
  completion(error);
}

@end
