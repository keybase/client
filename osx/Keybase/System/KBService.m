//
//  KBService.m
//  Keybase
//
//  Created by Gabriel on 5/15/15.
//  Copyright (c) 2015 Gabriel Handford. All rights reserved.
//

#import "KBService.h"

#import "KBAppDefines.h"
#import "AppDelegate.h"
#import "KBInfoView.h"

@interface KBService ()
@property KBRPClient *client;

@property (nonatomic) KBRGetCurrentStatusRes *userStatus;
@property (nonatomic) KBRConfig *userConfig;
@property NSError *statusError;

@property KBInfoView *infoView;
@end

@implementation KBService

- (instancetype)initWithConfig:(KBEnvConfig *)config {
  NSDictionary *info = [[NSBundle mainBundle] infoDictionary];
  if ((self = [super initWithConfig:config])) {
    [self setName:@"Service" info:@"The Keybase service" label:config.launchdLabelService bundleVersion:info[@"KBServiceVersion"] versionPath:[config cachePath:@"service.version"] plist:config.launchdPlistDictionaryForService];
  }
  return self;
}

- (NSView *)contentView {
  [self componentDidUpdate];
  return _infoView;
}

- (void)componentDidUpdate {
  GHODictionary *info = [GHODictionary dictionary];

  info[@"Home"] = KBPath(self.config.homeDir, YES);
  info[@"Socket"] = KBPath(self.config.sockFile, YES);

  info[@"Launchd"] = self.label ? self.label : @"-";
  GHODictionary *statusInfo = [self componentStatusInfo];
  if (statusInfo) [info addEntriesFromOrderedDictionary:statusInfo];

  if (_statusError) info[@"Status Error"] = _statusError.localizedDescription;

  info[@"API Server"] = _userConfig ? _userConfig.serverURI : @"-";
  info[@"Configured"] = _userStatus ? @(_userStatus.configured) : @"-";
  info[@"Registered"] = _userStatus ? @(_userStatus.registered) : @"-";
  info[@"Logged in"] = _userStatus ? @(_userStatus.loggedIn) : @"-";
  info[@"User"] = _userStatus ? _userStatus.user.username : @"-";
  info[@"User Id"] = _userStatus ? _userStatus.user.uid : @"-";

  if (self.config.installEnabled) {
    info[@"Launchd Plist"] = KBPath([self plistDestination], YES);
    info[@"Program"] = [self.config commandLineForService:NO escape:YES tilde:NO];
  }

  if (!_infoView) _infoView = [[KBInfoView alloc] init];
  [_infoView setProperties:info];
}

- (void)refresh:(KBCompletion)completion {
  [self updateComponentStatus:^(NSError *error) {
    if (error) {
      completion(error);
      return;
    }
    [self checkServiceStatus:completion];
  }];
}

- (void)checkServiceStatus:(KBCompletion)completion {
  GHWeakSelf gself = self;
  [self checkStatus:^(NSError *error, KBRGetCurrentStatusRes *userStatus, KBRConfig *userConfig) {
    gself.statusError = error;
    gself.userStatus = userStatus;
    gself.userConfig = userConfig;

    if (gself.label) {
      [KBLaunchCtl status:gself.label completion:^(KBServiceStatus *serviceStatus) {
        [self componentDidUpdate];
        completion(error);
      }];
    } else {
      [self componentDidUpdate];
      completion(error);
    }
  }];
}

- (KBRPClient *)client {
  if (!_client) {
    _client = [[KBRPClient alloc] initWithConfig:self.config];
  }
  if (_client.status == KBRPClientStatusClosed) [_client open];
  return _client;
}

- (void)checkStatus:(void (^)(NSError *error, KBRGetCurrentStatusRes *currentStatus, KBRConfig *config))completion {
  GHWeakSelf gself = self;
  KBRConfigRequest *statusRequest = [[KBRConfigRequest alloc] initWithClient:self.client];
  [statusRequest getCurrentStatusWithSessionID:statusRequest.sessionId completion:^(NSError *error, KBRGetCurrentStatusRes *userStatus) {
    gself.userStatus = userStatus;
    [self componentDidUpdate];
    if (error) {
      completion(error, userStatus, nil);
      return;
    }
    KBRConfigRequest *configRequest = [[KBRConfigRequest alloc] initWithClient:self.client];
    [configRequest getConfigWithSessionID:configRequest.sessionId completion:^(NSError *error, KBRConfig *userConfig) {
      gself.userConfig = userConfig;
      [self componentDidUpdate];
      completion(error, userStatus, userConfig);
    }];
  }];
}


@end
