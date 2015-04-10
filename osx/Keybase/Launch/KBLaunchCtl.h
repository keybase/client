//
//  KBLaunchCtl.h
//  Keybase
//
//  Created by Gabriel on 3/12/15.
//  Copyright (c) 2015 Gabriel Handford. All rights reserved.
//

#import <Foundation/Foundation.h>

#import <GHKit/GHKit.h>
#import "KBDefines.h"

typedef void (^KBLaunchExecution)(NSError *error, NSString *output);
typedef void (^KBLaunchStatus)(NSError *error, NSInteger pid);

@interface KBLaunchCtl : NSObject

- (instancetype)initWithHost:(NSString *)host home:(NSString *)home sockFile:(NSString *)sockFile pidFile:(NSString *)pidFile label:(NSString *)label;

/*!
 @param force Enables service even if it has been disabled (launchctl load -w)
 */
- (void)load:(BOOL)force completion:(KBLaunchExecution)completion;

/*!
 @param disable Disables service so it won't restart (launchctl unload -w)
 */
- (void)unload:(BOOL)disable completion:(KBLaunchExecution)completion;

- (void)reload:(KBLaunchStatus)completion;
- (void)status:(KBLaunchStatus)completion;

- (void)installLaunchAgent:(void (^)(NSError *error))completion;

@end
