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

// This should be larger than any timeouts a task uses internally
const NSTimeInterval KBDefaultTaskTimeout = 180.0;

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

+ (NSError *)checkForStatusErrorFromResponse:(id)response {
  if ([response isKindOfClass:NSDictionary.class]) {
    NSDictionary *dict = (NSDictionary *)response;
    NSDictionary *status = dict[@"status"];
    NSInteger code = [status[@"code"] integerValue];
    if (code != 0) {
      return KBMakeError(code, @"%@", status[@"desc"]);
    }
  }
  return nil;
}

- (BOOL)isInstalled {
  if (self.error) return NO;
  if (self.componentStatus.error) return NO;
  if (self.componentStatus.installStatus != KBRInstallStatusInstalled) return NO;
  return YES;
}

- (NSArray *)installDescription:(NSString *)delimeter {
  NSMutableArray *desc = [NSMutableArray array];
  if (self.error) {
    [desc addObject:NSStringWithFormat(@"Install Error: %@", self.error.localizedDescription)];
  }
  [desc addObjectsFromArray:[self statusDescription:delimeter]];
  return desc;
}

- (NSArray *)statusDescription:(NSString *)delimeter {
  NSMutableArray *status = [NSMutableArray array];
  if (self.isInstallDisabled) {
    [status addObject:@"Install Disabled"];
  }
  if (self.componentStatus.error) {
    [status addObject:NSStringWithFormat(@"Error: %@", self.componentStatus.error.localizedDescription)];
  }
  [status gh_addObject:[self.componentStatus statusDescription:delimeter]];
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

+ (NSError *)combineErrors:(NSArray *)installables ignoreWarnings:(BOOL)ignoreWarnings {
  NSMutableArray *errors = [NSMutableArray array];
  for (KBInstallable *installable in installables) {
    NSError *error = installable.error;
    if (!error) error = installable.componentStatus.error;
    if (!error) continue;

    // Ignore warnings
    if (ignoreWarnings && KBIsWarning(error)) {
      continue;
    }

    [errors addObject:error];
  }

  if ([errors count] == 0) {
    return nil;
  }
  if ([errors count] == 1) {
    return errors[0];
  }

  NSMutableArray *errorMessages = [NSMutableArray array];
  for (NSError *error in errors) {
    NSString *errorMessage = nil;
    if (error) {
      errorMessage = NSStringWithFormat(@"%@ (%@)", error.localizedDescription, @(error.code));
    }
    if (errorMessage && ![errorMessages containsObject:errorMessage]) [errorMessages addObject:errorMessage];
  }

  if ([errorMessages count] == 0) {
    // Success (no errors)
    return nil;
  }

  return KBMakeError(KBErrorCodeGeneric, @"%@", [errorMessages join:@".\n"]);
}

@end
