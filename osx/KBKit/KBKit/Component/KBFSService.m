//
//  KBFSService.m
//  Keybase
//
//  Created by Gabriel on 5/15/15.
//  Copyright (c) 2015 Gabriel Handford. All rights reserved.
//

#import "KBFSService.h"
#import "KBDebugPropertiesView.h"
#import "KBKeybaseLaunchd.h"
#import "KBSemVersion.h"
#import "KBTask.h"

@interface KBFSService ()
@property NSString *name;
@property NSString *info;
@property (getter=isInstallDisabled) BOOL installDisabled;

@property NSString *label;
@property KBSemVersion *bundleVersion;
@property KBComponentStatus *componentStatus;

@property KBEnvConfig *config;

@property YOView *infoView;
@end

@implementation KBFSService

- (instancetype)initWithConfig:(KBEnvConfig *)config label:(NSString *)label {
  if ((self = [self init])) {
    _config = config;
    _name = @"KBFS";
    _info = @"The filesystem";
    _label = label;
    NSDictionary *info = [[NSBundle mainBundle] infoDictionary];
    _bundleVersion = [KBSemVersion version:info[@"KBFSVersion"] build:info[@"KBFSBuild"]];
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

  info[@"Mount"] = [self.config mountDir];

  GHODictionary *statusInfo = [self.componentStatus statusInfo];
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
  /*
  NSString *mountDir = [self.config mountDir];
  NSError *error = nil;
  if (![KBPath ensureDirectory:mountDir error:&error]) {
    completion(error);
    return;
  }

  NSString *binPath = [_config serviceBinPathWithPathOptions:0 useBundle:YES];
  NSString *kbfsBinPath = [_config kbfsBinPathWithPathOptions:0 useBundle:YES];
  [KBKeybaseLaunchd install:binPath label:_label serviceBinPath:kbfsBinPath args:@[mountDir] completion:completion];
   */
  NSString *binPath = [_config serviceBinPathWithPathOptions:0 useBundle:YES];
  [KBTask execute:binPath args:@[@"-d", @"install", @"--components=kbfs"] completion:^(NSError *error, NSData *outData, NSData *errData) {
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

- (void)refreshComponent:(KBCompletion)completion {
  GHWeakSelf gself = self;
  [KBKeybaseLaunchd status:[_config serviceBinPathWithPathOptions:0 useBundle:YES] name:@"kbfs" bundleVersion:_bundleVersion completion:^(NSError *error, KBRServiceStatus *serviceStatus) {
    gself.componentStatus = [KBComponentStatus componentStatusWithServiceStatus:serviceStatus];
    [self componentDidUpdate];
    completion(error);
  }];
}

@end

