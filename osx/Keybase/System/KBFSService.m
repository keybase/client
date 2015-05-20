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

- (instancetype)initWithEnvironment:(KBEnvironment *)environment {
  if ((self = [super initWithEnvironment:environment])) {
    NSDictionary *info = [[NSBundle mainBundle] infoDictionary];
    [self setName:@"KBFS" info:@"The filesystem" label:environment.launchdLabelKBFS bundleVersion:info[@"KBFSVersion"] versionPath:nil plist:environment.launchdPlistDictionaryForKBFS];
  }
  return self;
}

- (NSView *)contentView {
  [self componentDidUpdate];
  return _infoView;
}

- (void)componentDidUpdate {
  GHODictionary *info = [GHODictionary dictionary];

  info[@"Launchd"] = self.label ? self.label : @"-";
  info[@"Version"] = GHOrNull([self version]);
  info[@"Bundle Version"] = self.bundleVersion;
  GHODictionary *statusInfo = [self componentStatusInfo];
  if (statusInfo) [info addEntriesFromOrderedDictionary:statusInfo];

  if (self.environment.installEnabled) {
    info[@"Launchd Plist"] = KBPath([self plistDestination], YES);
    info[@"Program"] = [self.environment commandLineForKBFS:NO escape:YES tilde:YES];
  }

  if (!_infoView) _infoView = [[KBInfoView alloc] init];
  [_infoView setProperties:info];
}

@end
