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

@property KBInfoView *infoView;
@end

@implementation KBService

- (instancetype)initWithEnvironment:(KBEnvironment *)environment client:(KBRPClient *)client {
  NSDictionary *info = [[NSBundle mainBundle] infoDictionary];
  if ((self = [super initWithName:@"Keybase" info:@"The Keybase Service" label:environment.launchdLabelService bundleVersion:info[@"KBServiceVersion"] versionPath:[environment cachePath:@"service.version"] plist:environment.launchdPlistDictionaryForService])) {

    _client = client;
  }
  return self;
}

- (NSView *)contentView {
  [self componentDidUpdate];
  return _infoView;
}

- (NSString *)version {
  return _config.version;
}

- (void)componentDidUpdate {
  GHODictionary *info = [GHODictionary dictionary];

  info[@"Socket"] = _config.socketFile;
  info[@"API Server"] = _config.serverURI;

  info[@"Launchd"] = self.label ? self.label : @"N/A";
  info[@"Version"] = GHOrNull([self version]);
  info[@"Bundle Version"] = self.bundleVersion;
  GHODictionary *statusInfo = [self componentStatusInfo];
  if (statusInfo) [info addEntriesFromOrderedDictionary:statusInfo];

  info[@"Configured"] = @(_userStatus.configured);
  info[@"Registered"] = @(_userStatus.registered);
  info[@"Logged in"] = @(_userStatus.loggedIn);
  info[@"User"] = _userStatus.user.username;
  info[@"User Id"] = KBHexString(_userStatus.user.uid, @"");

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

- (void)checkStatus:(void (^)(NSError *error, KBRGetCurrentStatusRes *currentStatus, KBRConfig *config))completion {
  GHWeakSelf gself = self;
  KBRConfigRequest *config = [[KBRConfigRequest alloc] initWithClient:_client];
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
