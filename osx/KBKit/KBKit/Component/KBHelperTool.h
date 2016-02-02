//
//  KBHelperTool.h
//  Keybase
//
//  Created by Gabriel on 5/10/15.
//  Copyright (c) 2015 Gabriel Handford. All rights reserved.
//

#import <Foundation/Foundation.h>

#import "KBComponent.h"
#import "KBInstallable.h"
#import <MPMessagePack/MPXPCClient.h>

@interface KBHelperTool : KBInstallable

@property (readonly, nonatomic) MPXPCClient *helper;

- (instancetype)initWithConfig:(KBEnvConfig *)config;

+ (MPXPCClient *)helper;

@end
