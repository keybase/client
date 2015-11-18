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

@property NSString *name;
@property NSString *info;
@property (getter=isInstallDisabled) BOOL installDisabled;

@property NSString *label;
@property KBSemVersion *bundleVersion;

@property KBEnvConfig *config;

@property KBComponentStatus *componentStatus;
@property KBRServiceStatus *serviceStatus;

@property YOView *infoView;
@end

@implementation KBService

- (instancetype)initWithConfig:(KBEnvConfig *)config label:(NSString *)label {
  if ((self = [self init])) {
    _config = config;
    _name = @"Service";
    _info = @"The Keybase service";

    _label = label;
    NSDictionary *info = [[NSBundle mainBundle] infoDictionary];
    _bundleVersion = [KBSemVersion version:info[@"KBServiceVersion"] build:info[@"KBServiceBuild"]];
  }
  return self;
}

- (KBRPClient *)client {
  if (!_client) {
    _client = [[KBRPClient alloc] initWithConfig:self.config options:KBRClientOptionsAutoRetry];
  }
  return _client;
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

  GHODictionary *statusInfo = [self.componentStatus statusInfo];
  if (statusInfo) [info addEntriesFromOrderedDictionary:statusInfo];

  YOView *view = [[YOView alloc] init];
  KBDebugPropertiesView *propertiesView = [[KBDebugPropertiesView alloc] init];
  [propertiesView setProperties:info];
  NSView *scrollView = [KBScrollView scrollViewWithDocumentView:propertiesView];
  [view addSubview:scrollView];

  /*
  YOHBox *buttons = [YOHBox box:@{@"spacing": @(10)}];
  [buttons addSubview:[KBButton buttonWithText:@"Panic" style:KBButtonStyleDanger options:KBButtonOptionsToolbar dispatchBlock:^(KBButton *button, dispatch_block_t completion) {
    [self panic:^(NSError *error) {
      completion();
    }];
  }]];
  [view addSubview:buttons];
   */

  view.viewLayout = [YOVBorderLayout layoutWithCenter:scrollView top:nil bottom:nil insets:UIEdgeInsetsZero spacing:10];

  _infoView = view;
}

- (void)refreshComponent:(KBCompletion)completion {
  GHWeakSelf gself = self;
  [KBKeybaseLaunchd status:[_config serviceBinPathWithPathOptions:0 useBundle:YES] name:@"service" bundleVersion:_bundleVersion completion:^(NSError *error, KBRServiceStatus *serviceStatus) {
    gself.serviceStatus = serviceStatus;
    gself.componentStatus = [KBComponentStatus componentStatusWithServiceStatus:serviceStatus];
    [self componentDidUpdate];
    completion(error);
  }];
}

- (void)panic:(KBCompletion)completion {
  KBRTestRequest *request = [[KBRTestRequest alloc] initWithClient:self.client];
  [request panicWithMessage:@"Testing panic" completion:^(NSError *error) {
    completion(error);
  }];
}

- (void)install:(KBCompletion)completion {
  NSString *binPath = [_config serviceBinPathWithPathOptions:0 useBundle:YES];
  [KBTask execute:binPath args:@[@"-d", @"install", @"--components=cli,service"] completion:^(NSError *error, NSData *outData, NSData *errData) {
    completion(error);
  }];
}

- (void)uninstall:(KBCompletion)completion {
  [KBKeybaseLaunchd run:[_config serviceBinPathWithPathOptions:0 useBundle:YES] args:@[@"launchd", @"uninstall", _label] completion:completion];
}

- (void)start:(KBCompletion)completion {
  [KBKeybaseLaunchd run:[_config serviceBinPathWithPathOptions:0 useBundle:YES] args:@[@"launchd", @"start", _label] completion:completion];
}

- (void)stop:(KBCompletion)completion {
  [KBKeybaseLaunchd run:[_config serviceBinPathWithPathOptions:0 useBundle:YES] args:@[@"launchd", @"stop", _label] completion:completion];
}

@end
