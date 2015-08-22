//
//  KBLaunchServiceInstall.m
//  Keybase
//
//  Created by Gabriel on 5/7/15.
//  Copyright (c) 2015 Gabriel Handford. All rights reserved.
//

#import "KBInstallAction.h"

#import <ObjectiveSugar/ObjectiveSugar.h>

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
  KBComponentStatus *status = _installable.componentStatus;
  if (status.error) {
    return NSStringWithFormat(@"Error: %@", status.error.localizedDescription);
  } else if (_error) {
    return NSStringWithFormat(@"Error: %@", _error.localizedDescription);
  } else {
    return status.statusDescription;
  }
}

@end
