//
//  KBService.m
//  Keybase
//
//  Created by Gabriel on 5/15/15.
//  Copyright (c) 2015 Gabriel Handford. All rights reserved.
//

#import "KBService.h"

#import "KBLaunchCtl.h"
#import "KBDebugPropertiesView.h"

@interface KBService ()
@property KBRPClient *client;

@property (nonatomic) KBRGetCurrentStatusRes *userStatus;
@property (nonatomic) KBRConfig *userConfig;
@property NSError *statusError;

@property YOView *infoView;
@end

@implementation KBService

- (instancetype)initWithConfig:(KBEnvConfig *)config {
  NSDictionary *info = [[NSBundle mainBundle] infoDictionary];
  if ((self = [super initWithConfig:config])) {
    [self setName:@"Service" info:@"The Keybase service" label:config.launchdLabelService bundleVersion:info[@"KBServiceVersion"] versionPath:[config cachePath:@"service.version"] plist:config.launchdPlistDictionaryForService];
  }
  return self;
}

- (NSView *)componentView {
  [self componentDidUpdate];
  return _infoView;
}

- (void)componentDidUpdate {
  GHODictionary *info = [GHODictionary dictionary];

  info[@"Home"] = KBPath(self.config.homeDir, YES, NO);
  info[@"Socket"] = KBPath(self.config.sockFile, YES, NO);

  info[@"Launchd"] = self.label ? self.label : @"-";
  GHODictionary *statusInfo = [self componentStatusInfo];
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

  if (self.config.installEnabled) {
    info[@"Launchd Plist"] = KBPath([self plistDestination], YES, NO);
  }

  if (!self.config.installEnabled) {
    info[@"Command"] = [self.config commandLineForService:NO escape:YES tilde:YES options:@[@"service"]];
  } else {
    info[@"Command"] = [self.config commandLineForService:YES escape:NO tilde:NO options:@[@"-L", @"service"]];
  }

  YOView *view = [[YOView alloc] init];
  KBDebugPropertiesView *propertiesView = [[KBDebugPropertiesView alloc] init];
  [propertiesView setProperties:info];
  NSView *scrollView = [KBScrollView scrollViewWithDocumentView:propertiesView];
  [view addSubview:scrollView];

  YOHBox *buttons = [YOHBox box:@{@"spacing": @(10)}];
  [buttons addSubview:[KBButton buttonWithText:@"Status" style:KBButtonStyleDefault options:KBButtonOptionsToolbar dispatchBlock:^(KBButton *button, dispatch_block_t completion) {
    [self checkServiceStatus:^(NSError *error) {
      completion();
    }];
  }]];
  [buttons addSubview:[KBButton buttonWithText:@"Panic" style:KBButtonStyleDanger options:KBButtonOptionsToolbar dispatchBlock:^(KBButton *button, dispatch_block_t completion) {
    [self panic:^(NSError *error) {
      completion();
    }];
  }]];
  [view addSubview:buttons];

  view.viewLayout = [YOBorderLayout layoutWithCenter:scrollView top:nil bottom:@[buttons] insets:UIEdgeInsetsZero spacing:10];

  _infoView = view;
}

- (void)refreshComponent:(KBCompletion)completion {
  [self updateComponentStatus:^(NSError *error) {
    if (error) {
      completion(error);
      return;
    }
    [self refreshLaunchStatus:completion];
  }];
}

- (void)refreshLaunchStatus:(KBCompletion)completion {
  GHWeakSelf gself = self;
  if (gself.label) {
    [KBLaunchCtl status:gself.label completion:^(KBServiceStatus *serviceStatus) {
      [self componentDidUpdate];
      completion(nil);
    }];
  } else {
    [self componentDidUpdate];
    completion(nil);
  }
}

- (KBRPClient *)client {
  if (!_client) {
    _client = [[KBRPClient alloc] initWithConfig:self.config];
  }
  return _client;
}

- (void)panic:(KBCompletion)completion {
  KBRCtlRequest *request = [[KBRCtlRequest alloc] initWithClient:self.client];
  [request panicWithMessage:@"Testing panic" completion:^(NSError *error) {
    completion(error);
  }];
}

- (void)checkServiceStatus:(KBCompletion)completion {
  KBRCtlRequest *request = [[KBRCtlRequest alloc] initWithClient:self.client];
  [request status:^(NSError *error, KBRServiceStatusRes *serviceStatusRes) {
    completion(error);
  }];
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
