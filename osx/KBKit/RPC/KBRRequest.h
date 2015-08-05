//
//  KBRRequest.h
//  Keybase
//
//  Created by Gabriel on 12/16/14.
//  Copyright (c) 2014 Gabriel Handford. All rights reserved.
//

#import <Foundation/Foundation.h>

#import "KBRPClient.h"

#define KBRValue(obj) (obj ? obj : NSNull.null)

#define KBErrorFromStatus(status) ([NSError errorWithDomain:@"Keybase" code:status.code userInfo:@{NSLocalizedDescriptionKey: KBRValue(status.desc), NSLocalizedRecoveryOptionsErrorKey: @[@"OK"]}])

@interface KBRRequest : NSObject

@property (readonly) KBRPClient *client;
@property (nonatomic) NSNumber *sessionId;

- (instancetype)initWithClient:(KBRPClient *)client;

@end
