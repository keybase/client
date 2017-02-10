//
//  KBService.m
//  Keybase
//
//  Created by Gabriel on 5/15/15.
//  Copyright (c) 2015 Gabriel Handford. All rights reserved.
//

#import "KBService.h"

#import "KBDebugPropertiesView.h"
#import "KBSemVersion.h"
#import "KBRPC.h"
#import "KBSemVersion.h"
#import "KBTask.h"
#import "KBKeybaseLaunchd.h"

@interface KBService ()
@property KBRPClient *client;

@property NSString *label;
@property NSString *servicePath;

@property KBRServiceStatus *serviceStatus;

@property YOView *infoView;
@end

@implementation KBService

- (instancetype)initWithConfig:(KBEnvConfig *)config label:(NSString *)label servicePath:(NSString *)servicePath {
  if ((self = [self initWithConfig:config name:@"Service" info:@"The Keybase service" image:[KBIcons imageForIcon:KBIconNetwork]])) {
    _label = label;
    _servicePath = servicePath;
  }
  return self;
}

- (KBRPClient *)client {
  if (!_client) {
    _client = [[KBRPClient alloc] initWithConfig:self.config options:KBRClientOptionsAutoRetry];
  }
  return _client;
}

- (NSView *)componentView {
  [self componentDidUpdate];
  return _infoView;
}

- (void)componentDidUpdate {
  GHODictionary *info = [GHODictionary dictionary];

  info[@"Home"] =  [KBPath path:self.config.homeDir options:KBPathOptionsTilde];
  info[@"Socket"] =  [KBPath path:self.config.sockFile options:KBPathOptionsTilde];

  GHODictionary *statusInfo = [self.componentStatus statusInfo];
  if (statusInfo) [info addEntriesFromOrderedDictionary:statusInfo];

  YOView *view = [[YOView alloc] init];
  KBDebugPropertiesView *propertiesView = [[KBDebugPropertiesView alloc] init];
  [propertiesView setProperties:info];
  NSView *scrollView = [KBScrollView scrollViewWithDocumentView:propertiesView];
  [view addSubview:scrollView];

  view.viewLayout = [YOVBorderLayout layoutWithCenter:scrollView top:nil bottom:nil insets:UIEdgeInsetsZero spacing:10];

  _infoView = view;
}

- (KBInstallRuntimeStatus)runtimeStatus {
  if (!self.serviceStatus) return KBInstallRuntimeStatusNone;
  return [NSString gh_isBlank:self.serviceStatus.pid] ? KBInstallRuntimeStatusStopped : KBInstallRuntimeStatusStarted;
}

- (void)refreshComponent:(KBRefreshComponentCompletion)completion {
  [KBKeybaseLaunchd status:[self.config serviceBinPathWithPathOptions:0 servicePath:self.servicePath] name:@"service" timeout:self.config.installTimeout completion:^(NSError *error, KBRServiceStatus *serviceStatus) {
    self.serviceStatus = serviceStatus;
    if (error) {
      self.componentStatus = [KBComponentStatus componentStatusWithError:error];
    } else {
      self.componentStatus = [KBComponentStatus componentStatusWithServiceStatus:serviceStatus];
    }
    [self componentDidUpdate];
    completion(self.componentStatus);
  }];
}

- (void)panic:(KBCompletion)completion {
  KBRTestRequest *request = [[KBRTestRequest alloc] initWithClient:self.client];
  [request panicWithMessage:@"Testing panic" completion:^(NSError *error) {
    completion(error);
  }];
}

- (void)install:(KBCompletion)completion {
  NSString *binPath = [self.config serviceBinPathWithPathOptions:0 servicePath:self.servicePath];
  [KBTask executeForJSONWithCommand:binPath args:@[@"-d", @"--log-format=file", @"install", @"--format=json", @"--components=service", NSStringWithFormat(@"--timeout=%@s", @(self.config.installTimeout))] timeout:KBDefaultTaskTimeout completion:^(NSError *error, id response) {
    if (!error) error = [KBInstallable checkForStatusErrorFromResponse:response];
    completion(error);
  }];
}

- (void)uninstall:(KBCompletion)completion {
  NSString *binPath = [self.config serviceBinPathWithPathOptions:0 servicePath:self.servicePath];
  [KBTask execute:binPath args:@[@"-d", @"--log-format=file", @"uninstall", @"--components=service"] timeout:KBDefaultTaskTimeout completion:^(NSError *error, NSData *outData, NSData *errData) {
    completion(error);
  }];
}

- (void)load:(KBCompletion)completion {
  [KBKeybaseLaunchd run:[self.config serviceBinPathWithPathOptions:0 servicePath:self.servicePath] args:@[@"launchd", @"start", _label] completion:completion];
}

- (void)unload:(KBCompletion)completion {
  [KBKeybaseLaunchd run:[self.config serviceBinPathWithPathOptions:0 servicePath:self.servicePath] args:@[@"launchd", @"stop", _label] completion:completion];
}

@end
