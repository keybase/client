//
//  KBLaunchCtl.h
//  Keybase
//
//  Created by Gabriel on 5/6/15.
//  Copyright (c) 2015 Gabriel Handford. All rights reserved.
//

#import <Foundation/Foundation.h>

#import "KBServiceStatus.h"

typedef void (^KBLaunchExecution)(NSError *error, NSString *output);
typedef void (^KBLaunchStatus)(KBServiceStatus *serviceStatus);


@interface KBLaunchCtl : NSObject

/*!
 @param force Enables service even if it has been disabled (launchctl load -w)
 */
+ (void)load:(NSString *)plist force:(BOOL)force completion:(KBLaunchExecution)completion;

/*!
 @param disable Disables service so it won't restart (launchctl unload -w)
 */
+ (void)unload:(NSString *)plist disable:(BOOL)disable completion:(KBLaunchExecution)completion;

+ (void)reload:(NSString *)plist label:(NSString *)label completion:(KBLaunchStatus)completion;

+ (void)status:(NSString *)label completion:(KBLaunchStatus)completion;

@end
