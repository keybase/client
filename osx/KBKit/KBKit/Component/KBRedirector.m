//
//  KBRedirector.m
//  KBKit
//
//  Created by strib on 2/21/18.
//

#import "KBRedirector.h"
#import "KBInstaller.h"

@interface KBRedirector ()
@property KBHelperTool *helperTool;
@property NSString *servicePath;
@end

@implementation KBRedirector

@synthesize error;

- (instancetype)initWithConfig:(KBEnvConfig *)config helperTool:(KBHelperTool *)helperTool servicePath:(NSString *)servicePath {
  if ((self = [self initWithConfig:config name:@"Redirector" info:@"Helper tool for redirector" image:nil])) {
    _helperTool = helperTool;
    _servicePath = servicePath;
  }
  return self;
}

- (NSString *)name {
  return @"Redirector";
}

- (void)install:(KBCompletion)completion {
  if ([self.config redirectorDisabled]) {
    DDLogDebug(@"The redirector is disabled; ignoring");
    completion(nil);
    return;
  }

  uid_t uid = 0;
  gid_t gid = 0;
  NSNumber *permissions = [NSNumber numberWithShort:0600];
  NSString *mount = [self.config redirectorMount];
  NSString *binPath = [self.config redirectorBinPathWithPathOptions:0 servicePath:_servicePath];
  NSDictionary *params = @{@"directory": mount, @"uid": @(uid), @"gid": @(gid), @"permissions": permissions, @"excludeFromBackup": @(YES), @"redirectorBin": binPath};
  DDLogDebug(@"Starting redirector: %@", params);
  [self.helperTool.helper sendRequest:@"startRedirector" params:@[params] completion:^(NSError *err, id value) {
    completion(err);
  }];
}

- (void)uninstall:(KBCompletion)completion {
  NSString *mount = [self.config redirectorMount];
  NSDictionary *params = @{@"directory": mount};

  if (![self.helperTool exists]) {
    DDLogDebug(@"Redirector wasn't installed (no helper), so no-op");
    completion(nil);
    return;
  }

  DDLogDebug(@"Stopping redirector: %@", params);
  [self.helperTool.helper sendRequest:@"stopRedirector" params:@[params] completion:^(NSError *err, id value) {
    completion(err);
  }];
}

@end
