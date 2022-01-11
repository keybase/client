//
//  AppearanceRootView.m
//  Keybase
//
//  Created by Chris Nojima on 9/9/19.
//  Copyright © 2019 Keybase. All rights reserved.
//

#import "AppearanceRootView.h"

@implementation AppearanceRootView

#if defined(__IPHONE_OS_VERSION_MAX_ALLOWED) && defined(__IPHONE_13_0) && \
    __IPHONE_OS_VERSION_MAX_ALLOWED >= __IPHONE_13_0
- (void)traitCollectionDidChange:(UITraitCollection *)previousTraitCollection
{
  NSString * RCTUserInterfaceStyleDidChangeNotification = @"RCTUserInterfaceStyleDidChangeNotification";
  [super traitCollectionDidChange:previousTraitCollection];

  if (@available(iOS 13.0, *)) {
    if ([previousTraitCollection hasDifferentColorAppearanceComparedToTraitCollection:self.traitCollection]) {
      [[NSNotificationCenter defaultCenter] postNotificationName:RCTUserInterfaceStyleDidChangeNotification
                                                          object:self
                                                        userInfo:@{@"traitCollection": self.traitCollection}];
    }
  }
}
#endif

@end
