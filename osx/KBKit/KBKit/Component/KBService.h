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

@interface KBService : KBInstallable

@property (readonly, nonatomic) KBRPClient *client;

- (instancetype)initWithConfig:(KBEnvConfig *)config label:(NSString *)label servicePath:(NSString *)servicePath;

@end
