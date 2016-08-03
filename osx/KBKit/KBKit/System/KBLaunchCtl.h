//
//  KBLaunchCtl.h
//  Keybase
//
//  Created by Gabriel on 5/6/15.
//  Copyright (c) 2015 Gabriel Handford. All rights reserved.
//

#import <Foundation/Foundation.h>

#import "KBLaunchdStatus.h"

typedef void (^KBOnLaunchCtlExecution)(NSError *error, NSString *output);
typedef void (^KBOnLaunchCtlStatus)(KBLaunchdStatus *serviceStatus);


@interface KBLaunchCtl : NSObject

/*!
 @param force Enables service even if it has been disabled (launchctl load -w)
 */
+ (void)load:(NSString *)plist label:(NSString *)label force:(BOOL)force completion:(KBOnLaunchCtlExecution)completion;

/*!
 Unload service.
 
 @param label If you want to wait for it to unload, specify the label (if nil, will not wait).
 @param disable If YES, disables service so it won't restart (launchctl unload -w)
 */
+ (void)unload:(NSString *)plist label:(NSString *)label disable:(BOOL)disable completion:(KBOnLaunchCtlExecution)completion;

+ (void)reload:(NSString *)plist label:(NSString *)label completion:(KBOnLaunchCtlStatus)completion;

+ (void)status:(NSString *)label completion:(KBOnLaunchCtlStatus)completion;

@end
