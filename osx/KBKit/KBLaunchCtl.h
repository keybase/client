//
//  KBLaunchCtl.h
//  Keybase
//
//  Created by Gabriel on 5/6/15.
//  Copyright (c) 2015 Gabriel Handford. All rights reserved.
//

#import <Foundation/Foundation.h>

#import "KBServiceStatus.h"

typedef void (^KBOnLaunchExecution)(NSError *error, NSString *output);
typedef void (^KBOnLaunchStatus)(KBServiceStatus *serviceStatus);


@interface KBLaunchCtl : NSObject

/*!
 @param force Enables service even if it has been disabled (launchctl load -w)
 */
+ (void)load:(NSString *)plist label:(NSString *)label force:(BOOL)force completion:(KBOnLaunchExecution)completion;

/*!
 @param disable Disables service so it won't restart (launchctl unload -w)
 */
+ (void)unload:(NSString *)plist label:(NSString *)label disable:(BOOL)disable completion:(KBOnLaunchExecution)completion;

+ (void)reload:(NSString *)plist label:(NSString *)label completion:(KBOnLaunchStatus)completion;

+ (void)status:(NSString *)label completion:(KBOnLaunchStatus)completion;

@end
