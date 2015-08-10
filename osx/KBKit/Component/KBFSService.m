//
//  KBFSService.m
//  Keybase
//
//  Created by Gabriel on 5/15/15.
//  Copyright (c) 2015 Gabriel Handford. All rights reserved.
//

#import "KBFSService.h"
#import "KBDebugPropertiesView.h"

@interface KBFSService ()
@property KBDebugPropertiesView *infoView;

@property KBEnvConfig *config;
@property NSString *name;
@property NSString *info;
@property KBLaunchService *launchService;
@end

@implementation KBFSService

- (instancetype)initWithConfig:(KBEnvConfig *)config {
  if ((self = [self init])) {
    _config = config;
    _name = @"KBFS";
    _info = @"The filesystem";
    NSDictionary *info = [[NSBundle mainBundle] infoDictionary];
    NSString *versionPath = [config appPath:@"kbfs.version" options:0];
    NSDictionary *plist = [KBFSService launchdPlistDictionaryForKBFS:_config];
    _launchService = [[KBLaunchService alloc] initWithLabel:config.launchdLabelKBFS bundleVersion:info[@"KBFSVersion"] versionPath:versionPath plist:plist logFile:[config logFile:config.launchdLabelKBFS]];
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
  info[@"Bundle Version"] = _launchService.bundleVersion;
  GHODictionary *statusInfo = [_launchService componentStatusInfo];
  if (statusInfo) [info addEntriesFromOrderedDictionary:statusInfo];

  if (self.config.installEnabled) {
    info[@"Launchd Plist"] = [KBPath path:[_launchService plistDestination] options:KBPathOptionsTilde];
  }

  if (!self.config.installEnabled) {
    info[@"Command"] = [KBFSService commandLineForKBFS:self.config useBundle:NO pathOptions:KBPathOptionsEscape args:nil];
  } else {
    info[@"Command"] = [KBFSService commandLineForKBFS:self.config useBundle:YES pathOptions:0 args:nil];
  }

  if (!_infoView) _infoView = [[KBDebugPropertiesView alloc] init];
  [_infoView setProperties:info];
}

- (void)ensureDirectory:(NSString *)directory completion:(KBCompletion)completion {
  BOOL isDirectory = NO;
  if (![NSFileManager.defaultManager fileExistsAtPath:directory isDirectory:&isDirectory]) {
    NSError *error = nil;
    if (![NSFileManager.defaultManager createDirectoryAtPath:directory withIntermediateDirectories:YES attributes:nil error:&error]) {
      completion(error);
      return;
    }
  }
  if (!isDirectory) {
    completion(KBMakeError(KBErrorCodePathInaccessible, @"Path exists, but isn't a directory"));
    return;
  }
  if (![NSFileManager.defaultManager isReadableFileAtPath:directory]) {
    completion(KBMakeError(KBErrorCodePathInaccessible, @"Path exists, but isn't readable"));
    return;
  }
  completion(nil);
}

/*!
 Try to fix the service based on the service status.
 */
// This is currently disabled. The KBFS service should fix mounting issues.
/*
- (void)checkServiceStatus:(KBServiceStatus *)serviceStatus completion:(KBCompletion)completion retry:(dispatch_block_t)retry {
  if ([serviceStatus.lastExitStatus integerValue] == 3) {
    [self umount:NO completion:^(NSError *error) {
      if (error) {
        completion(error);
      } else {
        retry();
      }
    }];
  } else {
    completion(serviceStatus.error);
  }
}
 */

// Unused.
/*
- (void)umount:(BOOL)force completion:(KBCompletion)completion {
  NSTask *task = [[NSTask alloc] init];
  if (force) {
    task.launchPath = @"/usr/sbin/diskutil";
    task.arguments = @[@"unmountDisk", @"force", self.config.mountDir];
  } else {
    task.launchPath = @"/sbin/umount";
    task.arguments = @[self.config.mountDir];
  }
  task.standardOutput = nil;
  task.standardError = nil;
  task.terminationHandler = ^(NSTask *t) {
    if (t.terminationStatus != 0) {
      completion(KBMakeError(-1, @"Unmount error"));
    } else {
      completion(nil);
    }
  };
  DDLogInfo(@"Unmounting: %@ %@", task.launchPath, task.arguments);
  [task launch];
}
 */

- (void)install:(KBCompletion)completion {
  NSString *mountDir = [self.config mountDir];
  GHWeakSelf gself = self;
  [self ensureDirectory:mountDir completion:^(NSError *error) {
    [gself.launchService install:5 completion:^(KBComponentStatus *componentStatus, KBServiceStatus *serviceStatus) {
      if ([serviceStatus.lastExitStatus integerValue] == 3) {
        completion(KBMakeError(-1, @"Failed with a mount error"));
      } else {
        completion(componentStatus.error);
      }
    }];
  }];
}

- (void)uninstall:(KBCompletion)completion {
  [_launchService uninstall:completion];
}

- (void)start:(KBCompletion)completion {
  [_launchService start:10 completion:^(KBComponentStatus *componentStatus, KBServiceStatus *serviceStatus) {
    completion(componentStatus.error);
  }];
}

- (void)stop:(KBCompletion)completion {
  [_launchService stop:completion];
}

- (void)refreshComponent:(KBCompletion)completion {
  [_launchService updateComponentStatus:0 completion:^(KBComponentStatus *componentStatus, KBServiceStatus *serviceStatus) {
    [self componentDidUpdate];

    if (!componentStatus && [serviceStatus.lastExitStatus integerValue] == 3) {
      completion(KBMakeError(-1, @"Failed with a mount error"));
    } else {
      completion(componentStatus.error);
    }
  }];
}

- (KBComponentStatus *)componentStatus {
  return _launchService.componentStatus;
}

+ (NSDictionary *)envsForKBS:(KBEnvConfig *)config pathOptions:(KBPathOptions)pathOptions {
  NSMutableDictionary *envs = [NSMutableDictionary dictionary];
  envs[@"PATH"] = @"/sbin:/usr/sbin:/Library/Filesystems/kbfuse.fs/Support"; // For umount, diskutil, mount_osxfusefs
  envs[@"KEYBASE_SOCKET_FILE"] = [KBPath path:[config sockFile] options:pathOptions];
  envs[@"KEYBASE_CONFIG_FILE"] = [KBPath path:[config configFile] options:pathOptions];
  return envs;
}

+ (NSArray *)programArgumentsForKBFS:(KBEnvConfig *)config useBundle:(BOOL)useBundle pathOptions:(KBPathOptions)pathOptions args:(NSArray *)args {
  NSMutableArray *pargs = [NSMutableArray array];

  if (useBundle) {
    [pargs addObject:NSStringWithFormat(@"%@/bin/kbfsfuse", config.bundle.sharedSupportPath)];
  } else {
    [pargs addObject:@"./kbfsfuse"];
  }

  if (config.debugEnabled) {
    [pargs addObject:@"-debug"];
  }

  [pargs addObject:@"-client"];

  [pargs addObject:NSStringWithFormat(@"-server-root=%@", [config appPath:nil options:pathOptions])];

  if (args) {
    [pargs addObjectsFromArray:args];
  }

  if (config.mountDir) [pargs addObject:[KBPath path:config.mountDir options:pathOptions]];

  return pargs;
}

+ (NSDictionary *)launchdPlistDictionaryForKBFS:(KBEnvConfig *)config {
  if (!config.launchdLabelKBFS) return nil;

  NSArray *args = [self programArgumentsForKBFS:config useBundle:YES pathOptions:0 args:nil];
  NSDictionary *envs = [self envsForKBS:config pathOptions:0];

  return @{
           @"Label": config.launchdLabelKBFS,
           @"EnvironmentVariables": envs,
           @"ProgramArguments": args,
           @"RunAtLoad": @YES,
           @"KeepAlive": @YES,
           @"WorkingDirectory": [config appPath:nil options:0],
           @"StandardOutPath": [config logFile:config.launchdLabelKBFS],
           @"StandardErrorPath": [config logFile:config.launchdLabelKBFS],
           };
}

+ (NSString *)commandLineForKBFS:(KBEnvConfig *)config useBundle:(BOOL)useBundle pathOptions:(KBPathOptions)pathOptions args:(NSArray *)args {
  NSString *envs = [[[self envsForKBS:config pathOptions:pathOptions] map:^(id key, id value) { return NSStringWithFormat(@"%@=%@", key, value); }] join:@" "];
  NSString *pargs = [[self programArgumentsForKBFS:config useBundle:useBundle pathOptions:pathOptions args:args] join:@" "];
  return NSStringWithFormat(@"%@ %@", envs, pargs);
}

@end

