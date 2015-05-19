//
//  KBService.m
//  Keybase
//
//  Created by Gabriel on 5/15/15.
//  Copyright (c) 2015 Gabriel Handford. All rights reserved.
//

#import "KBService.h"

#import "KBAppKit.h"
#import "AppDelegate.h"
#import "KBInfoView.h"

@interface KBService ()
@property KBRPClient *client;

@property (nonatomic) KBRGetCurrentStatusRes *userStatus;
@property (nonatomic) KBRConfig *config;
@property NSError *statusError;

@property KBInfoView *infoView;
@end

@implementation KBService

- (instancetype)initWithEnvironment:(KBEnvironment *)environment {
  NSDictionary *info = [[NSBundle mainBundle] infoDictionary];
  if ((self = [super initWithEnvironment:environment])) {
    [self setName:@"Service" info:@"The Keybase Service" label:environment.launchdLabelService bundleVersion:info[@"KBServiceVersion"] versionPath:[environment cachePath:@"service.version"] plist:environment.launchdPlistDictionaryForService];
  }
  return self;
}

- (NSView *)contentView {
  [self componentDidUpdate];
  return _infoView;
}

- (void)componentDidUpdate {
  GHODictionary *info = [GHODictionary dictionary];

  info[@"Home"] = KBPath(self.environment.homeDir, YES);
  info[@"Socket"] = KBPath(self.environment.sockFile, YES);

  info[@"Launchd"] = self.label ? self.label : @"N/A";
  info[@"Version"] = GHOrNull([self version]);
  info[@"Bundle Version"] = self.bundleVersion;
  GHODictionary *statusInfo = [self componentStatusInfo];
  if (statusInfo) [info addEntriesFromOrderedDictionary:statusInfo];

  if (_statusError) info[@"Status Error"] = _statusError;

  info[@"API Server"] = _config ? _config.serverURI : @"-";
  info[@"Configured"] = _userStatus ? @(_userStatus.configured) : @"-";
  info[@"Registered"] = _userStatus ? @(_userStatus.registered) : @"-";
  info[@"Logged in"] = _userStatus ? @(_userStatus.loggedIn) : @"-";
  info[@"User"] = _userStatus ? _userStatus.user.username : @"-";
  info[@"User Id"] = _userStatus ? KBHexString(_userStatus.user.uid, @"") : @"-";

  if (self.environment.installEnabled) {
    info[@"Launchd Plist"] = KBPath([self plistDestination], YES);
    info[@"Program"] = [self.environment commandLineForService:NO tilde:YES];
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
  [self checkStatus:^(NSError *error, KBRGetCurrentStatusRes *currentStatus, KBRConfig *config) {
    gself.statusError = error;
    gself.userStatus = currentStatus;
    gself.config = config;

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
    _client = [[KBRPClient alloc] initWithEnvironment:self.environment];
  }
  if (_client.status == KBRPClientStatusClosed) [_client open];
  return _client;
}

- (void)checkStatus:(void (^)(NSError *error, KBRGetCurrentStatusRes *currentStatus, KBRConfig *config))completion {
  GHWeakSelf gself = self;
  KBRConfigRequest *config = [[KBRConfigRequest alloc] initWithClient:self.client];
  [config getCurrentStatus:^(NSError *error, KBRGetCurrentStatusRes *status) {
    gself.userStatus = status;
    [self componentDidUpdate];
    if (error) {
      completion(error, status, nil);
      return;
    }
    KBRConfigRequest *request = [[KBRConfigRequest alloc] initWithClient:self.client];
    [request getConfig:^(NSError *error, KBRConfig *config) {
      gself.config = config;
      [self componentDidUpdate];
      completion(error, status, config);
    }];
  }];
}


@end
