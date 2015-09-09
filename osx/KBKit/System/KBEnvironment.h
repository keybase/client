//
//  KBEnvironment.h
//  Keybase
//
//  Created by Gabriel on 4/22/15.
//  Copyright (c) 2015 Gabriel Handford. All rights reserved.
//

#import <Foundation/Foundation.h>

#import "KBEnvConfig.h"
#import "KBService.h"
#import "KBFSService.h"
#import "KBInstallAction.h"

@interface KBEnvironment : NSObject

@property (readonly) KBEnvConfig *config;
@property (readonly) KBService *service;
@property (readonly) KBFSService *kbfs;
@property (readonly) NSArray */*of KBInstallAction*/installActions;
@property (readonly) NSArray */*of id<KBInstallable>*/installables;

+ (void)lookupForConfig:(KBEnvConfig *)config completion:(void (^)(KBEnvironment *environment))completion;

- (NSArray *)installActionsNeeded;

- (NSArray *)componentsForControlPanel;

@end
