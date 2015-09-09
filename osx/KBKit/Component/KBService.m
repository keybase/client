//
//  KBService.m
//  Keybase
//
//  Created by Gabriel on 5/15/15.
//  Copyright (c) 2015 Gabriel Handford. All rights reserved.
//

#import "KBService.h"

#import "KBLaunchCtl.h"
#import "KBLaunchService.h"
#import "KBDebugPropertiesView.h"
#import "KBSemVersion.h"
#import "KBServiceConfig.h"
#import "KBRPC.h"

@interface KBService ()
@property KBRPClient *client;

@property NSString *name;
@property NSString *info;

@property KBServiceConfig *serviceConfig;
@property KBLaunchService *launchService;

@property KBEnvConfig *config;
@property (nonatomic) KBRGetCurrentStatusRes *userStatus;
@property (nonatomic) KBRConfig *userConfig;
@property NSError *statusError;

@property YOView *infoView;
@end

@implementation KBService

- (instancetype)initWithConfig:(KBEnvConfig *)config label:(NSString *)label {
  if ((self = [self init])) {
    _config = config;
    _name = @"Service";
    _info = @"The Keybase service";
    _serviceConfig = [[KBServiceConfig alloc] initWithConfig:_config];

    if (label) {
      NSDictionary *plist = [_serviceConfig launchdPlistDictionary:label];
      NSDictionary *info = [[NSBundle mainBundle] infoDictionary];
      KBSemVersion *bundleVersion = [KBSemVersion version:info[@"KBServiceVersion"] build:info[@"KBServiceBuild"]];
      _launchService = [[KBLaunchService alloc] initWithLabel:label bundleVersion:bundleVersion versionPath:_serviceConfig.versionPath plist:plist logFile:[_config logFile:label]];
    }
  }
  return self;
}

- (NSImage *)image {
  return [KBIcons imageForIcon:KBIconNetwork];
}

- (NSView *)componentView {
  [self componentDidUpdate];
  return _infoView;
}

- (void)componentDidUpdate {
  GHODictionary *info = [GHODictionary dictionary];

  info[@"Home"] =  [KBPath path:self.config.homeDir options:KBPathOptionsTilde];
  info[@"Socket"] =  [KBPath path:self.config.sockFile options:KBPathOptionsTilde];

  info[@"Launchd"] = _launchService.label ? _launchService.label : @"-";
  GHODictionary *statusInfo = [_launchService componentStatusInfo];
  if (statusInfo) [info addEntriesFromOrderedDictionary:statusInfo];

  if (_statusError) info[@"Status Error"] = _statusError.localizedDescription;

  info[@"API Server"] = _userConfig ? _userConfig.serverURI : @"-";

  info[@"User"] = _userStatus ? _userStatus.user.username : @"-";
  info[@"User Id"] = _userStatus ? _userStatus.user.uid : @"-";

  NSMutableArray *userStatus = [NSMutableArray array];
  if (_userStatus.configured) [userStatus addObject:@"Configured"];
  if (_userStatus.registered) [userStatus addObject:@"Registered"];
  if (_userStatus.loggedIn) [userStatus addObject:@"Logged In"];
  info[@"User Status"] = [userStatus join:@", "];

  YOView *view = [[YOView alloc] init];
  KBDebugPropertiesView *propertiesView = [[KBDebugPropertiesView alloc] init];
  [propertiesView setProperties:info];
  NSView *scrollView = [KBScrollView scrollViewWithDocumentView:propertiesView];
  [view addSubview:scrollView];

  YOHBox *buttons = [YOHBox box:@{@"spacing": @(10)}];
  [buttons addSubview:[KBButton buttonWithText:@"Panic" style:KBButtonStyleDanger options:KBButtonOptionsToolbar dispatchBlock:^(KBButton *button, dispatch_block_t completion) {
    [self panic:^(NSError *error) {
      completion();
    }];
  }]];
  [view addSubview:buttons];

  view.viewLayout = [YOVBorderLayout layoutWithCenter:scrollView top:nil bottom:@[buttons] insets:UIEdgeInsetsZero spacing:10];

  _infoView = view;
}

+ (void)lookup:(KBEnvConfig *)config completion:(void (^)(NSError *error, NSString *label))completion {
  if (config.runMode == KBRunModeCustom) {
    completion(nil, nil);
    return;
  }

  KBRPClient *client = [[KBRPClient alloc] initWithConfig:config];

  dispatch_block_t close = ^{
    dispatch_async(dispatch_get_main_queue(), ^{ [client close]; });
  };

  NSString *defaultLabel = [config launchdServiceLabel];
  [client open:^(NSError *error) {
    if (error) {
      completion(error, defaultLabel);
      close();
      return;
    } else {
      KBRConfigRequest *configRequest = [[KBRConfigRequest alloc] initWithClient:client];
      [configRequest getConfig:^(NSError *error, KBRConfig *userConfig) {
        if (error) {
          completion(error, defaultLabel);
          close();
          return;
        }
        NSString *label = userConfig.label;
        if ([NSString gh_isBlank:userConfig.label]) label = defaultLabel;
        completion(nil, label);
        close();
      }];
    }
  }];
}

- (void)refreshComponent:(KBCompletion)completion {
  [self.launchService updateComponentStatus:0 completion:^(KBComponentStatus *componentStatus, KBServiceStatus *serviceStatus) {
    [self componentDidUpdate];
    completion(componentStatus.error);
  }];
}

- (KBRPClient *)client {
  if (!_client) {
    _client = [[KBRPClient alloc] initWithConfig:self.config];
  }
  return _client;
}

- (void)panic:(KBCompletion)completion {
  KBRTestRequest *request = [[KBRTestRequest alloc] initWithClient:self.client];
  [request panicWithMessage:@"Testing panic" completion:^(NSError *error) {
    completion(error);
  }];
}

- (void)checkStatus:(void (^)(NSError *error, KBRGetCurrentStatusRes *currentStatus, KBRConfig *config))completion {
  GHWeakSelf gself = self;
  KBRConfigRequest *statusRequest = [[KBRConfigRequest alloc] initWithClient:self.client];
  [statusRequest getCurrentStatus:^(NSError *error, KBRGetCurrentStatusRes *userStatus) {
    gself.userStatus = userStatus;
    [self componentDidUpdate];
    if (error) {
      completion(error, userStatus, nil);
      return;
    }
    KBRConfigRequest *configRequest = [[KBRConfigRequest alloc] initWithClient:self.client];
    [configRequest getConfig:^(NSError *error, KBRConfig *userConfig) {
      gself.userConfig = userConfig;
      [self componentDidUpdate];
      completion(error, userStatus, userConfig);
    }];
  }];
}

- (void)install:(KBCompletion)completion {
  [_launchService installWithTimeout:5 completion:^(KBComponentStatus *componentStatus, KBServiceStatus *serviceStatus) {
    completion(componentStatus.error);
  }];
}

- (void)uninstall:(KBCompletion)completion {
  [_launchService uninstall:completion];
}

- (void)start:(KBCompletion)completion {
  [_launchService start:5 completion:^(KBComponentStatus *componentStatus, KBServiceStatus *serviceStatus) {
    completion(componentStatus.error);
  }];
}

- (void)stop:(KBCompletion)completion {
  [_launchService stop:completion];
}

//- (void)updateComponentStatus:(NSTimeInterval)timeout completion:(KBCompletion)completion {
//  [_launchService updateComponentStatus:timeout completion:^(KBComponentStatus *componentStatus, KBServiceStatus *serviceStatus) {
//    [self componentDidUpdate];
//    completion(componentStatus.error);
//  }];
//}

- (KBComponentStatus *)componentStatus {
  return _launchService.componentStatus;
}

@end
