//
//  AppKeybase.h
//  Keybase
//
//  Created by Chris Nojima on 10/31/22.
//  Copyright © 2022 Keybase. All rights reserved.
//

#import <Foundation/Foundation.h>
#import "AppDelegate.h"

NS_ASSUME_NONNULL_BEGIN

@interface AppDelegate (KB) <UNUserNotificationCenterDelegate, UIDropInteractionDelegate, KbProvider>
- (void)didLaunchSetupBefore:(UIApplication *)application;
- (void)addDrop: (UIView*) rootView;
- (void)didLaunchSetupAfter: (UIView*) rootView;
@end

NS_ASSUME_NONNULL_END
