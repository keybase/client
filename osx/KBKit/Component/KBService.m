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

@property NSString *name;
@property NSString *info;

@property KBLaunchService *launchService;

@property KBEnvConfig *config;
@property (nonatomic) KBRGetCurrentStatusRes *userStatus;
@property (nonatomic) KBRConfig *userConfig;
@property NSError *statusError;

@property YOView *infoView;
@end

@implementation KBService

- (instancetype)initWithConfig:(KBEnvConfig *)config {
  if ((self = [self init])) {
    _config = config;
    _name = @"Service";
    _info = @"The Keybase service";
    NSDictionary *info = [[NSBundle mainBundle] infoDictionary];
    _launchService = [[KBLaunchService alloc] initWithLabel:config.launchdLabelService bundleVersion:info[@"KBServiceVersion"] versionPath:[config cachePath:@"service.version"] plist:config.launchdPlistDictionaryForService logFile:[config logFile:config.launchdLabelService]];
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

  info[@"Home"] = KBPath(self.config.homeDir, YES, NO);
  info[@"Socket"] = KBPath(self.config.sockFile, YES, NO);

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

  if (self.config.installEnabled) {
    info[@"Launchd Plist"] = KBPath([_launchService plistDestination], YES, NO);
  }

  if (!self.config.installEnabled) {
    info[@"Command"] = [self.config commandLineForService:NO escape:YES tilde:YES options:@[@"service"]];
  } else {
    info[@"Command"] = [self.config commandLineForService:YES escape:NO tilde:NO options:@[@"--log-format=file", @"service"]];
  }

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

- (void)refreshComponent:(KBCompletion)completion {
  [_launchService updateComponentStatus:0 completion:^(NSError *error) {
    if (error) {
      completion(error);
      return;
    }
    [self _refreshLaunchStatus:completion];
  }];
}

- (void)_refreshLaunchStatus:(KBCompletion)completion {
  [_launchService refreshLaunchStatus:^(NSError *error) {
    [self componentDidUpdate];
    completion(error);
  }];
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
  [_launchService install:completion];
}

- (void)uninstall:(KBCompletion)completion {
  [_launchService uninstall:completion];
}

- (void)start:(KBCompletion)completion {
  [_launchService start:completion];
}

- (void)stop:(KBCompletion)completion {
  [_launchService stop:completion];
}

- (void)updateComponentStatus:(NSTimeInterval)timeout completion:(KBCompletion)completion {
  [_launchService updateComponentStatus:timeout completion:^(NSError *error) {
    [self componentDidUpdate];
    completion(error);
  }];
}

- (KBComponentStatus *)componentStatus {
  return _launchService.componentStatus;
}

@end
