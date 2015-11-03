//
//  KBInstallAction.m
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

- (NSString *)action {
  if (_installable.isInstallDisabled) {
    return NSStringFromKBRInstallAction(KBRInstallActionNone);
  } else {
    return NSStringFromKBRInstallAction(_installable.componentStatus.installAction);
  }
}

- (NSArray *)statusDescription {
  NSMutableArray *status = [NSMutableArray array];
  if (_installable.isInstallDisabled) {
    [status addObject:@"Install Disabled"];
  }
  if (_installable.componentStatus.error) {
    [status addObject:NSStringWithFormat(@"Error: %@", _installable.componentStatus.error.localizedDescription)];
  }
  [status addObject:_installable.componentStatus.statusDescription];
  return status;
}

- (NSArray *)actionStatusDescription {
  NSMutableArray *status = [NSMutableArray array];
  if (_error) {
    [status addObject:NSStringWithFormat(@"Error: %@", _error.localizedDescription)];
  }
  return status;
}

@end
