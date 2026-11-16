//
//  KBUpdaterService.m
//  KBKit
//
//  Created by Gabriel on 6/7/16.
//
//

#import "KBUpdaterService.h"
#import "KBTask.h"
#import "KBKeybaseLaunchd.h"

@interface KBUpdaterService ()
@property NSString *label;
@property NSString *servicePath;
@property KBRServiceStatus *serviceStatus;
@end

@implementation KBUpdaterService

- (instancetype)initWithConfig:(KBEnvConfig *)config label:(NSString *)label servicePath:(NSString *)servicePath {
  if ((self = [self initWithConfig:config name:@"Updater" info:@"The updater service"])) {
    _label = label;
    _servicePath = servicePath;
  }
  return self;
}

- (void)install:(KBCompletion)completion {
  NSString *binPath = [self.config serviceBinPathWithPathOptions:0 servicePath:_servicePath];
  [KBTask executeForJSONWithCommand:binPath args:@[@"-d", @"--log-format=file", @"install", @"--format=json", @"--components=updater", NSStringWithFormat(@"--timeout=%@s", @(self.config.installTimeout))] timeout:KBDefaultTaskTimeout completion:^(NSError *error, id response) {
    if (!error) error = [KBInstallable checkForStatusErrorFromResponse:response];
    completion(error);
  }];
}

- (void)uninstall:(KBCompletion)completion {
  NSString *binPath = [self.config serviceBinPathWithPathOptions:0 servicePath:_servicePath];
  [KBTask execute:binPath args:@[@"-d", @"--log-format=file", @"uninstall", @"--components=updater"] timeout:KBDefaultTaskTimeout completion:^(NSError *error, NSData *outData, NSData *errData) {
    completion(error);
  }];
}

- (void)refreshComponent:(KBRefreshComponentCompletion)completion {
  [KBKeybaseLaunchd status:[self.config serviceBinPathWithPathOptions:0 servicePath:_servicePath] name:@"updater" timeout:self.config.installTimeout completion:^(NSError *error, KBRServiceStatus *serviceStatus) {
    self.serviceStatus = serviceStatus;
    if (error) {
      self.componentStatus = [KBComponentStatus componentStatusWithError:error];
    } else {
      self.componentStatus = [KBComponentStatus componentStatusWithServiceStatus:serviceStatus];
    }
    completion(self.componentStatus);
  }];
}

@end
