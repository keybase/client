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
  NSDictionary *info = [[NSBundle mainBundle] infoDictionary];
  return [super initWithName:@"KBFS" info:@"The filesystem" label:environment.launchdLabelKBFS bundleVersion:info[@"KBFSVersion"] versionPath:nil plist:environment.launchdPlistDictionaryForKBFS];
}

- (NSView *)contentView {
  [self componentDidUpdate];
  return _infoView;
}

- (void)componentDidUpdate {
  GHODictionary *info = [GHODictionary dictionary];

  info[@"Launchd"] = self.label ? self.label : @"N/A";
  info[@"Version"] = GHOrNull([self version]);
  info[@"Bundle Version"] = self.bundleVersion;
  GHODictionary *statusInfo = [self componentStatusInfo];
  if (statusInfo) [info addEntriesFromOrderedDictionary:statusInfo];

  if (!_infoView) _infoView = [[KBInfoView alloc] init];
  [_infoView setProperties:info];
}

@end
