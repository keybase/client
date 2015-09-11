//
//  KBFSService.m
//  Keybase
//
//  Created by Gabriel on 5/15/15.
//  Copyright (c) 2015 Gabriel Handford. All rights reserved.
//

#import "KBFSService.h"
#import "KBDebugPropertiesView.h"
#import "KBFSConfig.h"
#import "KBLaunchService.h"

@interface KBFSService ()
@property KBEnvConfig *config;
@property KBFSConfig *kbfsConfig;
@property NSString *name;
@property NSString *info;
@property KBLaunchService *launchService;

@property YOView *infoView;
@end

@implementation KBFSService

- (instancetype)initWithConfig:(KBEnvConfig *)config label:(NSString *)label {
  if ((self = [self init])) {
    _config = config;
    _name = @"KBFS";
    _info = @"The filesystem";
    _kbfsConfig = [[KBFSConfig alloc] initWithConfig:_config];

    if (label) {
      NSDictionary *info = [[NSBundle mainBundle] infoDictionary];
      NSDictionary *plist = [_kbfsConfig launchdPlistDictionary:label];
      KBSemVersion *bundleVersion = [KBSemVersion version:info[@"KBFSVersion"] build:info[@"KBFSBuild"]];
      _launchService = [[KBLaunchService alloc] initWithLabel:label bundleVersion:bundleVersion versionPath:_kbfsConfig.versionPath plist:plist logFile:[config logFile:label]];
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

  info[@"Launchd"] = _launchService.label ? _launchService.label : @"-";

  GHODictionary *statusInfo = [_launchService componentStatusInfo];
  if (statusInfo) [info addEntriesFromOrderedDictionary:statusInfo];

  YOView *view = [[YOView alloc] init];
  KBDebugPropertiesView *propertiesView = [[KBDebugPropertiesView alloc] init];
  [propertiesView setProperties:info];
  NSView *scrollView = [KBScrollView scrollViewWithDocumentView:propertiesView];
  [view addSubview:scrollView];

  YOHBox *buttons = [YOHBox box:@{@"spacing": @(10)}];
  [view addSubview:buttons];

  view.viewLayout = [YOVBorderLayout layoutWithCenter:scrollView top:nil bottom:@[buttons] insets:UIEdgeInsetsZero spacing:10];

  _infoView = view;
}

- (void)install:(KBCompletion)completion {
  NSString *mountDir = [self.config mountDir];
  GHWeakSelf gself = self;

  NSError *error = nil;
  if (![KBPath ensureDirectory:mountDir error:&error]) {
    completion(error);
    return;
  }

  if (![KBPath ensureDirectory:[_config appPath:nil options:0] error:&error]) {
    completion(error);
    return;
  }

  if (![KBPath ensureDirectory:[_config cachePath:nil options:0] error:&error]) {
    completion(error);
    return;
  }

  if (![KBPath ensureDirectory:[_config runtimePath:nil options:0] error:&error]) {
    completion(error);
    return;
  }

  [gself.launchService installWithTimeout:5 completion:^(KBComponentStatus *componentStatus, KBServiceStatus *serviceStatus) {
    if ([serviceStatus.lastExitStatus integerValue] == 3) {
      completion(KBMakeError(-1, @"Failed with a mount error"));
    } else {
      completion(componentStatus.error);
    }
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

- (void)refreshComponent:(KBCompletion)completion {
  if (!_launchService) {
    [self componentDidUpdate];
    completion(nil);
    return;
  }

  [_launchService updateComponentStatus:0 completion:^(KBComponentStatus *componentStatus, KBServiceStatus *serviceStatus) {
    [self componentDidUpdate];
    completion(componentStatus.error);
  }];
}

- (KBComponentStatus *)componentStatus {
  return _launchService.componentStatus;
}

@end

