//
//  KBFSService.m
//  Keybase
//
//  Created by Gabriel on 5/15/15.
//  Copyright (c) 2015 Gabriel Handford. All rights reserved.
//

#import "KBFSService.h"

@implementation KBFSService

- (instancetype)initWithEnvironment:(KBEnvironment *)environment {
  NSDictionary *info = [[NSBundle mainBundle] infoDictionary];
  return [super initWithName:@"KBFS" info:@"The filesystem" label:environment.launchdLabelKBFS bundleVersion:info[@"KBFSVersion"] versionPath:nil plist:environment.launchdPlistDictionaryForKBFS];
}

- (NSView *)contentView {
  //KBFSStatusView *view = [[KBFSStatusView alloc] init];
  return nil;
}

@end
