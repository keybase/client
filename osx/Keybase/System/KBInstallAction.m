//
//  KBLaunchServiceInstall.m
//  Keybase
//
//  Created by Gabriel on 5/7/15.
//  Copyright (c) 2015 Gabriel Handford. All rights reserved.
//

#import "KBInstallAction.h"

@interface KBInstallAction ()
@property id<KBInstallable> component;
@end

@implementation KBInstallAction

+ (instancetype)installActionWithComponent:(id<KBInstallable>)component {
  KBInstallAction *installAction = [[KBInstallAction alloc] init];
  installAction.component = component;
  return installAction;
}

- (NSString *)name {
  return _component.name;
}

- (NSString *)statusDescription {
  KBComponentStatus *status = _component.componentStatus;
  if (status.error) {
    return NSStringWithFormat(@"Error: %@", status.error.localizedDescription);
  } else if (_installError) {
    return NSStringWithFormat(@"Install Error: %@", _installError.localizedDescription);
  } else {
    return status.statusDescription;
  }
}

@end
