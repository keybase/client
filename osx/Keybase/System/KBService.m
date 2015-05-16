//
//  KBService.m
//  Keybase
//
//  Created by Gabriel on 5/15/15.
//  Copyright (c) 2015 Gabriel Handford. All rights reserved.
//

#import "KBService.h"

#import "KBAppKit.h"
#import "AppDelegate.h"

@implementation KBService

- (instancetype)initWithEnvironment:(KBEnvironment *)environment {
  NSDictionary *info = [[NSBundle mainBundle] infoDictionary];
  return [super initWithName:@"Service" info:@"Where the magic happens" label:environment.launchdLabelService bundleVersion:info[@"KBServiceVersion"] versionPath:[environment cachePath:@"service.version"] plist:environment.launchdPlistDictionaryForService];
}

- (NSView *)contentView {
  GHWeakSelf gself = self;
  KBButton *checkButton = [KBButton buttonWithText:@"Status" style:KBButtonStyleToolbar];
  checkButton.dispatchBlock = ^(KBButton *button, KBButtonCompletion completion) {
    [AppDelegate.appView checkStatus:^(NSError *error) {
      if (gself.label) {
        [KBLaunchCtl status:gself.label completion:^(KBServiceStatus *serviceStatus) {
          KBConsoleLog(@"Keybase (launchctl): %@", serviceStatus);
          completion(error);
        }];
      } else {
        completion(error);
      }
    }];
  };

  return nil;
}

@end
