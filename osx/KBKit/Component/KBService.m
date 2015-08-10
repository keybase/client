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
    NSString *versionPath = [config cachePath:@"service.version" options:0];
    NSDictionary *plist = [KBService launchdPlistDictionaryForService:_config];
    _launchService = [[KBLaunchService alloc] initWithLabel:config.launchdLabelService bundleVersion:info[@"KBServiceVersion"] versionPath:versionPath plist:plist logFile:[config logFile:config.launchdLabelService]];
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

  if (self.config.installEnabled) {
    info[@"Launchd Plist"] = [KBPath path:[_launchService plistDestination] options:KBPathOptionsTilde];
  }

  if (!self.config.installEnabled) {
    info[@"Command"] = [KBService commandLineForService:self.config useBundle:NO pathOptions:KBPathOptionsTilde|KBPathOptionsEscape args:@[@"service"]];
  } else {
    info[@"Command"] = [KBService commandLineForService:self.config useBundle:YES pathOptions:0 args:@[@"--log-format=file", @"service"]];
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
  [_launchService updateComponentStatus:0 completion:^(KBComponentStatus *componentStatus, KBServiceStatus *serviceStatus) {
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
  [_launchService install:5 completion:^(KBComponentStatus *componentStatus, KBServiceStatus *serviceStatus) {
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

- (void)updateComponentStatus:(NSTimeInterval)timeout completion:(KBCompletion)completion {
  [_launchService updateComponentStatus:timeout completion:^(KBComponentStatus *componentStatus, KBServiceStatus *serviceStatus) {
    [self componentDidUpdate];
    completion(componentStatus.error);
  }];
}

- (KBComponentStatus *)componentStatus {
  return _launchService.componentStatus;
}

+ (NSArray *)programArgumentsForKeybase:(KBEnvConfig *)config useBundle:(BOOL)useBundle pathOptions:(KBPathOptions)pathOptions args:(NSArray *)args {
  NSMutableArray *pargs = [NSMutableArray array];
  if (useBundle) {
    [pargs addObject:NSStringWithFormat(@"%@/bin/keybase", config.bundle.sharedSupportPath)];
  } else {
    [pargs addObject:@"./keybase"];
  }
  if (config.homeDir) {
    [pargs addObjectsFromArray:@[@"-H", [KBPath path:config.homeDir options:pathOptions]]];
  }

  if (config.host) {
    [pargs addObjectsFromArray:@[@"-s", config.host]];
  }

  if (config.debugEnabled) {
    [pargs addObject:@"-d"];
  }

  if (config.sockFile) {
    [pargs addObject:NSStringWithFormat(@"--socket-file=%@", [KBPath path:config.sockFile options:0])];
  }

  if (args) {
    [pargs addObjectsFromArray:args];
  }

  return pargs;
}

+ (NSDictionary *)launchdPlistDictionaryForService:(KBEnvConfig *)config {
  if (!config.launchdLabelService) return nil;

  NSArray *args = [self programArgumentsForKeybase:config useBundle:YES pathOptions:0 args:@[@"--log-format=file", @"service"]];

  return @{
           @"Label": config.launchdLabelService,
           @"ProgramArguments": args,
           @"RunAtLoad": @YES,
           @"KeepAlive": @YES,
           @"WorkingDirectory": [config appPath:nil options:0],
           @"StandardOutPath": [config logFile:config.launchdLabelService],
           @"StandardErrorPath": [config logFile:config.launchdLabelService],
           };
}

+ (NSString *)commandLineForService:(KBEnvConfig *)config useBundle:(BOOL)useBundle pathOptions:(KBPathOptions)pathOptions args:(NSArray *)args {
  return [[self programArgumentsForKeybase:config useBundle:useBundle pathOptions:pathOptions args:args] join:@" "];
}

@end
