//
//  KBService.h
//  Keybase
//
//  Created by Gabriel on 5/15/15.
//  Copyright (c) 2015 Gabriel Handford. All rights reserved.
//

#import <Foundation/Foundation.h>

#import "KBLaunchService.h"
#import "KBRPC.h"
#import "KBRPClient.h"

@interface KBService : KBLaunchService

@property (readonly, nonatomic) KBRPClient *client;
@property (readonly, nonatomic) KBRGetCurrentStatusRes *userStatus;
@property (readonly, nonatomic) KBRConfig *userConfig;

- (void)checkStatus:(void (^)(NSError *error, KBRGetCurrentStatusRes *userStatus, KBRConfig *userConfig))completion;

- (void)ping:(KBCompletion)completion;

@end
