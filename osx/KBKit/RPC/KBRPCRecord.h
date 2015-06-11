//
//  KBRPCRecord.h
//  Keybase
//
//  Created by Gabriel on 3/4/15.
//  Copyright (c) 2015 Gabriel Handford. All rights reserved.
//

#import <Foundation/Foundation.h>

@interface KBRPCRecord : NSObject

- (void)recordRequest:(NSString *)method params:(NSArray *)params sessionId:(NSInteger)sessionId callback:(BOOL)callback;
- (void)recordResponse:(NSString *)method response:(NSArray *)response sessionId:(NSInteger)sessionId;

@end

