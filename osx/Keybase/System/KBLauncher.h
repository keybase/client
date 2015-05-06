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
#import "KBEnvironment.h"
#import "KBLaunchCtl.h"

@interface KBLauncher : NSObject

@property (readonly) KBEnvironment *environment;

- (instancetype)initWithEnvironment:(KBEnvironment *)environment;

- (void)status:(KBLaunchStatus)completion;

/*!
 Launchd plist for environment.
 */
+ (NSString *)launchdPlistForEnvironment:(KBEnvironment *)environment error:(NSError **)error;

- (void)installLaunchAgent:(KBCompletion)completion;

@end
