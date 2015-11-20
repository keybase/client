//
//  KBInstallable.m
//  Keybase
//
//  Created by Gabriel on 5/18/15.
//  Copyright (c) 2015 Gabriel Handford. All rights reserved.
//

#import "KBInstallable.h"
#import <GHKit/GHKit.h>
#import <ObjectiveSugar/ObjectiveSugar.h>

@interface KBInstallable ()
@property KBEnvConfig *config;
@end

@implementation KBInstallable

- (instancetype)initWithConfig:(KBEnvConfig *)config name:(NSString *)name info:(NSString *)info image:(NSImage *)image {
  if ((self = [super initWithName:name info:info image:image])) {
    _config = config;
  }
  return self;
}

- (void)setComponentStatus:(KBComponentStatus *)componentStatus {
  _componentStatus = componentStatus;
  [self componentDidUpdate];
}

- (void)componentDidUpdate { }

- (KBInstallRuntimeStatus)runtimeStatus {
  return KBInstallRuntimeStatusNone;
}

- (NSArray *)statusDescription {
  NSMutableArray *status = [NSMutableArray array];
  if (self.isInstallDisabled) {
    [status addObject:@"Install Disabled"];
  }
  if (self.componentStatus.error) {
    [status addObject:NSStringWithFormat(@"Error: %@", self.componentStatus.error.localizedDescription)];
  }
  [status gh_addObject:self.componentStatus.statusDescription];
  return status;
}

- (NSString *)action {
  if (self.isInstallDisabled) {
    return NSStringFromKBRInstallAction(KBRInstallActionNone);
  } else {
    return NSStringFromKBRInstallAction(self.componentStatus.installAction);
  }
}

- (void)refreshComponent:(KBRefreshComponentCompletion)completion {
  completion(nil);
}

- (void)install:(KBCompletion)completion {
  completion(KBMakeError(KBErrorCodeUnsupported, @"Unsupported"));
}


- (void)uninstall:(KBCompletion)completion {
  completion(KBMakeError(KBErrorCodeUnsupported, @"Unsupported"));
}

- (void)start:(KBCompletion)completion {
  completion(KBMakeError(KBErrorCodeUnsupported, @"Unsupported"));
}

- (void)stop:(KBCompletion)completion {
  completion(KBMakeError(KBErrorCodeUnsupported, @"Unsupported"));
}

@end
