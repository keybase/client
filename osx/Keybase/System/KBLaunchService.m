//
//  KBLaunchCtl.m
//  Keybase
//
//  Created by Gabriel on 3/12/15.
//  Copyright (c) 2015 Gabriel Handford. All rights reserved.
//

#import "KBLaunchService.h"
#import "KBEnvironment.h"
#import "KBLaunchCtl.h"
#import "AppDelegate.h"
#import "KBTask.h"

@interface KBLaunchService ()
@property NSString *name;
@property NSString *info;
@property NSString *label;
@property NSString *versionPath;
@property NSDictionary *plist;

@property NSString *bundleVersion;
@property NSNumber *pid;
@property NSNumber *lastExitStatus;
@end

@implementation KBLaunchService

- (void)setName:(NSString *)name info:(NSString *)info label:(NSString *)label bundleVersion:(NSString *)bundleVersion versionPath:(NSString *)versionPath plist:(NSDictionary *)plist {
  _name = name;
  _info = info;
  _label = label;
  _versionPath = versionPath;
  _plist = plist;
  _bundleVersion = bundleVersion;
}

- (NSImage *)image {
  return [KBIcons imageForIcon:KBIconNetwork];
}

- (NSString *)version {
  if (self.componentStatus.installStatus == KBInstallStatusNotInstalled) return nil;
  return _versionPath ? [NSString stringWithContentsOfFile:_versionPath encoding:NSUTF8StringEncoding error:nil] : nil;
}

- (GHODictionary *)componentStatusInfo {
  GHODictionary *info = [GHODictionary dictionary];

  if (self.componentStatus) {
    info[@"Status Error"] = self.componentStatus.error;
    info[@"Install Status"] = NSStringFromKBInstallStatus(self.componentStatus.installStatus);
    info[@"Runtime Status"] = NSStringFromKBRuntimeStatus(self.componentStatus.runtimeStatus);
  } else {
    info[@"Install Status"] = @"Install Disabled";
    info[@"Runtime Status"] = @"-";
  }

  if (!_lastExitStatus) {
    info[@"PID"] = KBOr(_pid, @"-");
  } else {
    info[@"PID"] = NSStringWithFormat(@"%@ (%@)", KBOr(_pid, @"-"), KBOr(_lastExitStatus, @"-"));
  }
  return info;
}

- (void)updateComponentStatus:(KBCompletion)completion {
  if (!_label) {
    completion(nil);
    return;
  }

  NSString *bundleVersion = self.bundleVersion;
  NSString *runningVersion = [self version];
  self.pid = nil;
  self.lastExitStatus = nil;
  GHODictionary *info = [GHODictionary dictionary];
  [KBLaunchCtl status:_label completion:^(KBServiceStatus *serviceStatus) {
    if (!serviceStatus) {
      NSString *plistDest = [self plistDestination];
      KBInstallStatus installStatus = runningVersion && [NSFileManager.defaultManager fileExistsAtPath:plistDest] ? KBInstallStatusInstalled : KBInstallStatusNotInstalled;

      self.componentStatus = [KBComponentStatus componentStatusWithInstallStatus:installStatus runtimeStatus:KBRuntimeStatusNotRunning info:info];
      completion(nil);
      return;
    }

    if (serviceStatus.error) {
      self.componentStatus = [KBComponentStatus componentStatusWithError:serviceStatus.error];
      completion(serviceStatus.error);
    } else {
      if (runningVersion) info[@"Version"] = runningVersion;
      if (serviceStatus.isRunning) {
        self.pid = serviceStatus.pid;
        info[@"pid"] = serviceStatus.pid;
        if (![runningVersion isEqualToString:bundleVersion]) {
          if (bundleVersion) info[@"New Version"] = bundleVersion;
          self.componentStatus = [KBComponentStatus componentStatusWithInstallStatus:KBInstallStatusNeedsUpgrade runtimeStatus:KBRuntimeStatusRunning info:info];
          completion(nil);
        } else {
          self.componentStatus = [KBComponentStatus componentStatusWithInstallStatus:KBInstallStatusInstalled runtimeStatus:KBRuntimeStatusRunning info:info];
          completion(nil);
        }
      } else {
        self.lastExitStatus = serviceStatus.lastExitStatus;
        info[@"exit"] = serviceStatus.lastExitStatus;
        self.componentStatus = [KBComponentStatus componentStatusWithInstallStatus:KBInstallStatusInstalled runtimeStatus:KBRuntimeStatusNotRunning info:info];
        completion(nil);
      }
    }
  }];
}

- (NSString *)plistDestination {
  if (!_label) return nil;
  NSString *launchAgentDir = [[NSSearchPathForDirectoriesInDomains(NSLibraryDirectory, NSUserDomainMask, YES) firstObject] stringByAppendingPathComponent:@"LaunchAgents"];
  NSString *plistDest = [launchAgentDir stringByAppendingPathComponent:NSStringWithFormat(@"%@.plist", _label)];
  return plistDest;
}

- (void)install:(KBCompletion)completion {
  [self installLaunchAgent:completion];
}

- (void)installLaunchAgent:(KBCompletion)completion {

  NSString *plistDest = [self plistDestination];
  if (!plistDest) {
    NSError *error = KBMakeErrorWithRecovery(-1, @"Install Error", @"No launch agent destination.", nil);
    completion(error);
    return;
  }

  //
  // TODO
  // Only install if not exists or upgrade. We are currently always installing/updating the plist.
  //
  //if (![NSFileManager.defaultManager fileExistsAtPath:launchAgentPlistDest]) {
  NSError *error = nil;

  // Remove if exists
  if ([NSFileManager.defaultManager fileExistsAtPath:plistDest]) {
    if (![NSFileManager.defaultManager removeItemAtPath:plistDest error:&error]) {
      if (!error) error = KBMakeErrorWithRecovery(-1, @"Install Error", @"Unable to remove existing luanch agent plist for upgrade.", nil);
      completion(error);
      return;
    }
  }

  NSDictionary *plistDict = _plist;
  NSData *data = [NSPropertyListSerialization dataWithPropertyList:plistDict format:NSPropertyListXMLFormat_v1_0 options:0 error:&error];
  if (!data) {
    if (!error) error = KBMakeErrorWithRecovery(-1, @"Install Error", @"Unable to create plist data.", nil);
    completion(error);
    return;
  }

  if (![data writeToFile:plistDest atomically:YES]) {
    if (!error) error = KBMakeErrorWithRecovery(-1, @"Install Error", @"Unable to create launch agent plist.", nil);
    completion(error);
    return;
  }

  // We installed the launch agent plist
  DDLogDebug(@"Installed launch agent plist");

  [KBLaunchCtl reload:plistDest label:_label completion:^(KBServiceStatus *serviceStatus) {
    completion(serviceStatus.error);
  }];
}

- (void)uninstall:(KBCompletion)completion {
  NSString *plistDest = [self plistDestination];
  if (!plistDest || ![NSFileManager.defaultManager fileExistsAtPath:plistDest isDirectory:nil]) {
    completion(KBMakeError(-1, @"Nothing to uninstall"));
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

- (void)start:(KBCompletion)completion {
  NSString *plistDest = [self plistDestination];
  [KBLaunchCtl load:plistDest label:_label force:YES completion:^(NSError *error, NSString *output) {
    completion(error);
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
