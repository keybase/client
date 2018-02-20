//
//  KBRedirector.m
//  KBKit
//
//  Created by Jeremy on 2/20/18.
//

#import "KBRedirector.h"
#import "KBInstaller.h"

@interface KBRedirector ()
@property KBHelperTool *helperTool;
@end

@implementation KBRedirector

@synthesize error;

- (instancetype)initWithConfig:(KBEnvConfig *)config helperTool:(KBHelperTool *)helperTool {
  if ((self = [self initWithConfig:config name:@"Redirector" info:@"Helper tool for redirector" image:nil])) {
    _helperTool = helperTool;
  }
  return self;
}

- (NSString *)name {
  return @"Redirector";
}

- (void)install:(KBCompletion)completion {
  uid_t uid = 0;
  gid_t gid = 0;
  NSNumber *permissions = [NSNumber numberWithShort:0600];
  NSDictionary *params = @{@"directory": @"/keybase", @"uid": @(uid), @"gid": @(gid), @"permissions": permissions, @"excludeFromBackup": @(YES), @"redirectorBin": "/Applications/Keybase.app/Contents/SharedSupport/bin/keybase-redirector"};
  DDLogDebug(@"Starting redirector: %@", params);
  [self.helperTool.helper sendRequest:@"startRedirector" params:@[params] completion:^(NSError *err, id value) {
    completion(err);
  }];
}

@end
