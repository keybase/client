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
    _launchService = [[KBLaunchService alloc] initWithLabel:config.launchdLabelKBFS bundleVersion:info[@"KBFSVersion"] versionPath:[config appPath:@"kbfs.version"] plist:config.launchdPlistDictionaryForKBFS logFile:[config logFile:config.launchdLabelKBFS]];
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
    info[@"Launchd Plist"] = KBPath([_launchService plistDestination], YES, NO);
  }

  if (!self.config.installEnabled) {
    info[@"Command"] = [self.config commandLineForKBFS:NO escape:YES tilde:YES options:nil];
  } else {
    info[@"Command"] = [self.config commandLineForKBFS:YES escape:NO tilde:NO options:nil];
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

- (void)install:(KBCompletion)completion {
  NSString *mountDir = [self.config mountDir];
  GHWeakSelf gself = self;
  [self ensureDirectory:mountDir completion:^(NSError *error) {
    [gself.launchService install:completion];
  }];
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
