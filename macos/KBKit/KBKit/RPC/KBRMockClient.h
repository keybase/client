//
//  KBRMockClient.h
//  Keybase
//
//  Created by Gabriel on 2/25/15.
//  Copyright (c) 2015 Gabriel Handford. All rights reserved.
//

#import <Foundation/Foundation.h>

#import "KBRPClient.h"

@interface KBRMockClient : KBRPClient

@property (copy) MPRequestCompletion completion;
@property (copy) MPRequestHandler handler;

+ (NSArray *)requestForMethod:(NSString *)method;
+ (NSDictionary *)responseForMethod:(NSString *)method;

@end
