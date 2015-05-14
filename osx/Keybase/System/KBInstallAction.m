//
//  KBLaunchServiceInstall.m
//  Keybase
//
//  Created by Gabriel on 5/7/15.
//  Copyright (c) 2015 Gabriel Handford. All rights reserved.
//

#import "KBInstallAction.h"

@interface KBInstallAction ()
@property id<KBInstallable> installable;
@end

@implementation KBInstallAction

+ (instancetype)installActionWithInstallable:(id<KBInstallable>)installable {
  KBInstallAction *installAction = [[KBInstallAction alloc] init];
  installAction.installable = installable;
  return installAction;
}

- (NSString *)name {
  return _installable.name;
}

- (NSString *)statusDescription {
  if (_status.error) {
    return NSStringWithFormat(@"Error: %@", _status.error.localizedDescription);
  } else if (_installError) {
    return NSStringWithFormat(@"Install Error: %@", _installError.localizedDescription);
  } else {
    return _status.statusDescription;
  }
}

@end
