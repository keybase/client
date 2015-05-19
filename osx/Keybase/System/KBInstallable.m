//
//  KBInstallable.m
//  Keybase
//
//  Created by Gabriel on 5/18/15.
//  Copyright (c) 2015 Gabriel Handford. All rights reserved.
//

#import "KBInstallable.h"

@implementation KBInstallableComponent

- (void)setComponentStatus:(KBComponentStatus *)componentStatus {
  _componentStatus = componentStatus;
  [self componentDidUpdate];
}

- (void)componentDidUpdate { }

- (NSString *)version { return nil; }

- (GHODictionary *)componentStatusInfo {
  if (!_componentStatus) return [GHODictionary dictionary];
  GHODictionary *info = [GHODictionary dictionary];

  info[@"Status Error"] = _componentStatus.error;
  info[@"Install Status"] = NSStringFromKBInstallStatus(_componentStatus.installStatus);
  info[@"Runtime Status"] = NSStringFromKBRuntimeStatus(_componentStatus.runtimeStatus);

  return info;
}

- (void)updateComponentStatus:(KBCompletion)completion { completion(nil); }

- (void)refresh:(KBCompletion)completion {
  [self updateComponentStatus:completion];
}

@end
