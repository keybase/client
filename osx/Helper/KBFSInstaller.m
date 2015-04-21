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

@interface KBFSInstaller ()
@property BOOL installing;
@end

@implementation KBFSInstaller

- (void)loadFuseKext {
  OSReturn status = KextManagerLoadKextWithIdentifier(CFSTR("com.github.osxfuse.filesystems.osxfusefs"), NULL);
  if (status != kOSReturnSuccess) {

  }
}

- (BOOL)install:(NSError **)error {
  if (_installing) {
    if (error) *error = KBMakeError(-1001, @"Install in progress");
    return NO;
  }

  return YES;
}

@end
