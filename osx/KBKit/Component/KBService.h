//
//  KBService.h
//  Keybase
//
//  Created by Gabriel on 5/15/15.
//  Copyright (c) 2015 Gabriel Handford. All rights reserved.
//

#import <Foundation/Foundation.h>

#import "KBComponent.h"
#import "KBInstallable.h"
#import "KBEnvConfig.h"
#import "KBRPC.h"
#import "KBRPClient.h"

@interface KBService : NSObject <KBComponent, KBInstallable>

@property (readonly, nonatomic) KBRPClient *client;
@property (readonly, nonatomic) KBRGetCurrentStatusRes *userStatus;
@property (readonly, nonatomic) KBRConfig *userConfig;

- (instancetype)initWithConfig:(KBEnvConfig *)config;

- (void)checkStatus:(void (^)(NSError *error, KBRGetCurrentStatusRes *userStatus, KBRConfig *userConfig))completion;

@end
