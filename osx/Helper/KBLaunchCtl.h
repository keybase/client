//
//  KBLaunchCtl.h
//  Keybase
//
//  Created by Gabriel on 5/6/15.
//  Copyright (c) 2015 Gabriel Handford. All rights reserved.
//

#import <Foundation/Foundation.h>

typedef void (^KBLaunchExecution)(NSError *error, NSString *output);
typedef void (^KBLaunchStatus)(NSError *error, NSInteger pid);


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

+ (void)wait:(NSString *)label load:(BOOL)load attempt:(NSInteger)attempt completion:(KBLaunchStatus)completion;


@end
