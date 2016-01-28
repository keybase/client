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
@property NSString *label;
@property NSString *servicePath;
@property KBRServiceStatus *serviceStatus;
@property KBHelperTool *helperTool;
@property YOView *infoView;
@end

@implementation KBFSService

- (instancetype)initWithConfig:(KBEnvConfig *)config helperTool:(KBHelperTool *)helperTool label:(NSString *)label servicePath:(NSString *)servicePath {
  if ((self = [self initWithConfig:config name:@"KBFS" info:@"The filesystem service" image:[KBIcons imageForIcon:KBIconNetwork]])) {
    _helperTool = helperTool;
    _label = label;
    _servicePath = servicePath;
  }
  return self;
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

- (KBInstallRuntimeStatus)runtimeStatus {
  if (!self.serviceStatus) return KBInstallRuntimeStatusNone;
  return [NSString gh_isBlank:self.serviceStatus.pid] ? KBInstallRuntimeStatusStopped : KBInstallRuntimeStatusStarted;
}

- (BOOL)checkMountDir {
  NSString *directory = self.config.mountDir;
  BOOL exists = [NSFileManager.defaultManager fileExistsAtPath:directory isDirectory:nil];
  if (exists) {
    NSError *error = nil;
    NSDictionary *attributes = [NSFileManager.defaultManager attributesOfItemAtPath:directory error:&error];
    if (attributes) {
      DDLogDebug(@"Mount directory=%@, attributes=%@", directory, attributes);
    } else {
      DDLogDebug(@"Mount directory error: %@", error);
    }
  } else {
    DDLogDebug(@"Mount directory doesn't exist: %@", directory);
  }
  return exists;
}

- (void)createMountDir:(KBCompletion)completion {
  uid_t uid = getuid();
  gid_t gid = getgid();
  // Make the dir 0600 so we can't go into it while unmounted.
  NSNumber *permissions = [NSNumber numberWithShort:0600];
  NSDictionary *params = @{@"directory": self.config.mountDir, @"uid": @(uid), @"gid": @(gid), @"permissions": permissions, @"excludeFromBackup": @(YES)};
  DDLogDebug(@"Creating mount directory: %@", params);
  [self.helperTool.helper sendRequest:@"createDirectory" params:@[params] completion:^(NSError *error, id value) {
    completion(error);
  }];
}

- (void)install:(KBCompletion)completion {
  if (![self checkMountDir]) {
    [self createMountDir:^(NSError *error) {
      if (error) {
        completion(error);
        return;
      }
      [self _install:completion];
    }];
  } else {
    [self _install:completion];
  }
}

- (void)_install:(KBCompletion)completion {
  NSString *binPath = [self.config serviceBinPathWithPathOptions:0 servicePath:_servicePath];
  [KBTask executeForJSONWithCommand:binPath args:@[@"-d", @"--log-format=file", @"install", @"--format=json", @"--components=kbfs"] completion:^(NSError *error, id response) {
    if (!error) error = [KBInstallable checkForStatusErrorFromResponse:response];
    completion(error);
  }];
}

- (void)uninstall:(KBCompletion)completion {
  NSString *binPath = [self.config serviceBinPathWithPathOptions:0 servicePath:_servicePath];
  [KBTask execute:binPath args:@[@"-d", @"--log-format=file", @"uninstall", @"--components=kbfs"] completion:^(NSError *error, NSData *outData, NSData *errData) {
    completion(error);
  }];
}

- (void)start:(KBCompletion)completion {
  [KBKeybaseLaunchd run:[self.config serviceBinPathWithPathOptions:0 servicePath:_servicePath] args:@[@"launchd", @"start", _label] completion:completion];
}

- (void)stop:(KBCompletion)completion {
  [KBKeybaseLaunchd run:[self.config serviceBinPathWithPathOptions:0 servicePath:_servicePath] args:@[@"launchd", @"stop", _label] completion:completion];
}

- (void)refreshComponent:(KBRefreshComponentCompletion)completion {
  [KBKeybaseLaunchd status:[self.config serviceBinPathWithPathOptions:0 servicePath:_servicePath] name:@"kbfs" completion:^(NSError *error, KBRServiceStatus *serviceStatus) {
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

@end

