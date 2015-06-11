//
//  KBFSService.m
//  Keybase
//
//  Created by Gabriel on 5/15/15.
//  Copyright (c) 2015 Gabriel Handford. All rights reserved.
//

#import "KBFSService.h"
#import "KBInfoView.h"

@interface KBFSService ()
@property KBInfoView *infoView;
@end

@implementation KBFSService

- (instancetype)initWithConfig:(KBEnvConfig *)config {
  if ((self = [super initWithConfig:config])) {
    NSDictionary *info = [[NSBundle mainBundle] infoDictionary];
    [self setName:@"KBFS" info:@"The filesystem" label:config.launchdLabelKBFS bundleVersion:info[@"KBFSVersion"] versionPath:nil plist:config.launchdPlistDictionaryForKBFS];
  }
  return self;
}

- (NSView *)componentView {
  [self componentDidUpdate];
  return _infoView;
}

- (void)componentDidUpdate {
  GHODictionary *info = [GHODictionary dictionary];

  info[@"Launchd"] = self.label ? self.label : @"-";
  info[@"Bundle Version"] = self.bundleVersion;
  GHODictionary *statusInfo = [self componentStatusInfo];
  if (statusInfo) [info addEntriesFromOrderedDictionary:statusInfo];

  if (self.config.installEnabled) {
    info[@"Launchd Plist"] = KBPath([self plistDestination], YES, NO);
    info[@"Program"] = [self.config commandLineForKBFS:YES escape:NO tilde:NO];
  }

  if (!_infoView) _infoView = [[KBInfoView alloc] init];
  [_infoView setProperties:info];
}

@end
