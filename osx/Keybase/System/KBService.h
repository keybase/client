//
//  KBService.h
//  Keybase
//
//  Created by Gabriel on 5/15/15.
//  Copyright (c) 2015 Gabriel Handford. All rights reserved.
//

#import <Foundation/Foundation.h>

#import "KBLaunchService.h"
#import "KBEnvironment.h"
#import "KBRPC.h"

@interface KBService : KBLaunchService

@property (readonly, nonatomic) KBRPClient *client;
@property (readonly, nonatomic) KBRGetCurrentStatusRes *userStatus;
@property (readonly, nonatomic) KBRConfig *config;

- (void)checkStatus:(void (^)(NSError *error, KBRGetCurrentStatusRes *currentStatus, KBRConfig *config))completion;

@end
