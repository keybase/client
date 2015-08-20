//
//  KBLaunchService.m
//  Keybase
//
//  Created by Gabriel on 3/12/15.
//  Copyright (c) 2015 Gabriel Handford. All rights reserved.
//

#import "KBLaunchService.h"
#import "KBEnvironment.h"
#import "KBLaunchCtl.h"
#import "KBWaitFor.h"
#import "KBIcons.h"

#import <ObjectiveSugar/ObjectiveSugar.h>
#import <CocoaLumberjack/CocoaLumberjack.h>

@interface KBLaunchService ()
@property NSString *label;
@property NSString *versionPath;
@property NSDictionary *plist;

@property NSString *bundleVersion;
@property NSString *runningVersion;

@property KBServiceStatus *serviceStatus;
@property KBComponentStatus *componentStatus;
@end

@implementation KBLaunchService

- (instancetype)initWithLabel:(NSString *)label bundleVersion:(NSString *)bundleVersion versionPath:(NSString *)versionPath plist:(NSDictionary *)plist logFile:(NSString *)logFile {
  if ((self = [super init])) {
    _label = label;
    _versionPath = versionPath;
    _plist = plist;
    _bundleVersion = bundleVersion;
    _logFile = logFile;
  }
  return self;
}

- (GHODictionary *)componentStatusInfo {
  GHODictionary *info = [GHODictionary dictionary];

  if (self.componentStatus) {
    info[@"Status Error"] = self.componentStatus.error.localizedDescription;
    info[@"Install Status"] = NSStringFromKBInstallStatus(self.componentStatus.installStatus);
    info[@"Runtime Status"] = NSStringFromKBRuntimeStatus(self.componentStatus.runtimeStatus);
  } else {
    info[@"Install Status"] = @"Install Disabled";
    info[@"Runtime Status"] = @"-";
  }

  info[@"Version"] = KBOr(self.runningVersion, @"-");
  info[@"Bundle Version"] = KBOr(self.bundleVersion, @"-");


  info[@"PID"] = KBOr(self.serviceStatus.pid, @"-");
  info[@"Exit Status"] = KBOr(self.serviceStatus.lastExitStatus, @"-");

  return info;
}

- (void)waitForVersionFile:(NSTimeInterval)timeout completion:(void (^)(NSString *runningVersion))completion {
  NSString *versionPath = _versionPath;
  KBWaitForBlock block = ^(KBWaitForCheck completion) {
    if (!versionPath) {
      completion(YES, nil);
    } else {
      NSString *version = [NSString stringWithContentsOfFile:versionPath encoding:NSUTF8StringEncoding error:nil];
      if (version) DDLogDebug(@"Version file: %@", version);
      completion(NO, version);
    }
  };
  [KBWaitFor waitFor:block delay:0.5 timeout:timeout label:NSStringWithFormat(@"%@ (version file)", _label) completion:completion];
}

- (void)updateComponentStatus:(NSTimeInterval)timeout completion:(void (^)(KBComponentStatus *componentStatus, KBServiceStatus *serviceStatus))completion {
  self.serviceStatus = nil;
  self.runningVersion = nil;
  self.componentStatus = nil;

  if (!_label) {
    completion(nil, nil);
    return;
  }
  NSString *label = _label;
  [KBLaunchCtl status:label completion:^(KBServiceStatus *serviceStatus) {
    self.serviceStatus = serviceStatus;
    if (!serviceStatus) {
      NSString *plistDest = [self plistDestination];
      KBInstallStatus installStatus = [NSFileManager.defaultManager fileExistsAtPath:plistDest] ? KBInstallStatusInstalled : KBInstallStatusNotInstalled;

      GHODictionary *info = [GHODictionary dictionary];
      if (serviceStatus.lastExitStatus) info[@"Status"] = serviceStatus.lastExitStatus;
      self.componentStatus = [KBComponentStatus componentStatusWithInstallStatus:installStatus runtimeStatus:KBRuntimeStatusNotRunning info:info];
      completion(self.componentStatus, self.serviceStatus);
      return;
    }

    if (serviceStatus.error) {
      self.componentStatus = [KBComponentStatus componentStatusWithError:serviceStatus.error];
      completion(self.componentStatus, self.serviceStatus);
    } else {
      [self waitForVersionFile:timeout completion:^(NSString *runningVersion) {
        GHODictionary *info = [GHODictionary dictionary];
        if (serviceStatus.isRunning && runningVersion) {
          self.runningVersion = runningVersion;
          info[@"Version"] = runningVersion;
          if (![runningVersion isEqualToString:self.bundleVersion]) {
            info[@"New Version"] = self.bundleVersion;
            self.componentStatus = [KBComponentStatus componentStatusWithInstallStatus:KBInstallStatusNeedsUpgrade runtimeStatus:KBRuntimeStatusRunning info:info];
          } else {
            self.componentStatus = [KBComponentStatus componentStatusWithInstallStatus:KBInstallStatusInstalled runtimeStatus:KBRuntimeStatusRunning info:info];
          }
        } else {
          self.componentStatus = [KBComponentStatus componentStatusWithInstallStatus:KBInstallStatusInstalled runtimeStatus:KBRuntimeStatusNotRunning info:nil];
        }

        [KBLaunchCtl status:label completion:^(KBServiceStatus *serviceStatus) {
          self.serviceStatus = serviceStatus;
          completion(self.componentStatus, self.serviceStatus);
        }];
      }];
    }
  }];
}

- (NSString *)plistDestination {
  if (!_label) return nil;
  NSString *launchAgentDir = [[NSSearchPathForDirectoriesInDomains(NSLibraryDirectory, NSUserDomainMask, YES) firstObject] stringByAppendingPathComponent:@"LaunchAgents"];
  NSString *plistDest = [launchAgentDir stringByAppendingPathComponent:NSStringWithFormat(@"%@.plist", _label)];
  return plistDest;
}

- (void)installWithTimeout:(NSTimeInterval)timeout completion:(KBLaunchComponentStatus)completion {

  NSString *plistDest = [self plistDestination];
  if (!plistDest) {
    NSError *error = KBMakeErrorWithRecovery(-1, @"Install Error", @"No launch agent destination.", nil);
    completion([KBComponentStatus componentStatusWithError:error], nil);
    return;
  }

  //
  // TODO
  // Only install if not exists or upgrade. We are currently always installing/updating the plist.
  //
  //if (![NSFileManager.defaultManager fileExistsAtPath:launchAgentPlistDest]) {
  NSError *error = nil;

  // Returns yes if created successfully or already exists
  if (![NSFileManager.defaultManager createFileAtPath:_logFile contents:[NSData data] attributes:nil]) {
    if (!error) error = KBMakeErrorWithRecovery(-1, @"Install Error", @"Unable to touch log file: %@.", _logFile);
    completion([KBComponentStatus componentStatusWithError:error], nil);
    return;
  }

  // Remove plist file if exists
  if ([NSFileManager.defaultManager fileExistsAtPath:plistDest]) {
    if (![NSFileManager.defaultManager removeItemAtPath:plistDest error:&error]) {
      if (!error) error = KBMakeErrorWithRecovery(-1, @"Install Error", @"Unable to remove existing launch agent plist for upgrade.");
      completion([KBComponentStatus componentStatusWithError:error], nil);
      return;
    }
  }

  // Remove version file if exists
  if ([NSFileManager.defaultManager fileExistsAtPath:_versionPath]) {
    if (![NSFileManager.defaultManager removeItemAtPath:_versionPath error:&error]) {
      if (!error) error = KBMakeErrorWithRecovery(-1, @"Install Error", @"Unable to remove existing version file.");
      completion([KBComponentStatus componentStatusWithError:error], nil);
      return;
    }
  }

  NSDictionary *plistDict = _plist;
  NSData *data = [NSPropertyListSerialization dataWithPropertyList:plistDict format:NSPropertyListXMLFormat_v1_0 options:0 error:&error];
  if (!data) {
    if (!error) error = KBMakeErrorWithRecovery(-1, @"Install Error", @"Unable to create plist data.");
    completion([KBComponentStatus componentStatusWithError:error], nil);
    return;
  }

  if (![data writeToFile:plistDest atomically:YES]) {
    if (!error) error = KBMakeErrorWithRecovery(-1, @"Install Error", @"Unable to create launch agent plist.");
    completion([KBComponentStatus componentStatusWithError:error], nil);
    return;
  }

  // We installed the launch agent plist
  DDLogDebug(@"Installed launch agent plist");

  [KBLaunchCtl reload:plistDest label:_label completion:^(KBServiceStatus *reloadStatus) {
    [self updateComponentStatus:timeout completion:completion];
  }];
}

- (void)uninstall:(KBCompletion)completion {
  NSString *plistDest = [self plistDestination];
  if (!plistDest || ![NSFileManager.defaultManager fileExistsAtPath:plistDest isDirectory:nil]) {
    completion(nil);
    return;
  }
  NSString *label = _label;
  [KBLaunchCtl unload:plistDest label:label disable:NO completion:^(NSError *error, NSString *output) {
    if (error) {
      completion(error);
      return;
    }
    [NSFileManager.defaultManager removeItemAtPath:plistDest error:&error];
    completion(error);
  }];
}

- (void)start:(NSTimeInterval)timeout completion:(KBLaunchComponentStatus)completion {
  NSString *plistDest = [self plistDestination];
  NSString *label = _label;
  [KBLaunchCtl load:plistDest label:label force:YES completion:^(NSError *error, NSString *output) {
    [self updateComponentStatus:timeout completion:^(KBComponentStatus *componentStatus, KBServiceStatus *serviceStatus) {
      completion(componentStatus, serviceStatus);
    }];
  }];
}

- (void)stop:(KBCompletion)completion {
  NSString *plistDest = [self plistDestination];
  [KBLaunchCtl unload:plistDest label:_label disable:NO completion:^(NSError *error, NSString *output) {
    completion(error);
  }];
}

//- (void)checkLaunch:(void (^)(NSError *error))completion {
//  launch_data_t config = launch_data_alloc(LAUNCH_DATA_DICTIONARY);
//
//  launch_data_t val;
//  val = launch_data_new_string("keybase.keybased");
//  launch_data_dict_insert(config, val, LAUNCH_JOBKEY_LABEL);
//  val = launch_data_new_string("/Applications/Keybase.app/Contents/MacOS/keybased");
//  launch_data_dict_insert(config, val, LAUNCH_JOBKEY_PROGRAM);
//  val = launch_data_new_bool(YES);
//  launch_data_dict_insert(config, val, LAUNCH_JOBKEY_KEEPALIVE);
//
//  launch_data_t msg = launch_data_alloc(LAUNCH_DATA_DICTIONARY);
//  launch_data_dict_insert(msg, config, LAUNCH_KEY_SUBMITJOB);
//
//  launch_data_t response = launch_msg(msg);
//  if (!response) {
//    NSError *error = KBMakeErrorWithRecovery(-1, @"Launchd Error", @"Unable to launch keybased agent.", nil);
//    completion(error);
//  } else if (response && launch_data_get_type(response) == LAUNCH_DATA_ERRNO) {
//    //strerror(launch_data_get_errno(response))
//    //NSError *error = KBMakeErrorWithRecovery(-1, @"Launchd Error", @"Unable to launch keybased agent (LAUNCH_DATA_ERRNO).", nil);
//    //completion(error);
//    completion(nil);
//  } else {
//    completion(nil);
//  }
//}

@end
