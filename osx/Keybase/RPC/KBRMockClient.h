//
//  KBRMockClient.h
//  Keybase
//
//  Created by Gabriel on 2/25/15.
//  Copyright (c) 2015 Gabriel Handford. All rights reserved.
//

#import <Foundation/Foundation.h>

#import "KBRPClient.h"

@interface KBRMockClient : NSObject <KBRPClient>

@property (readonly, copy) MPRequestCompletion completion;

- (void)recordMethod:(NSString *)method params:(NSArray *)params;

- (void)replayRecordId:(NSString *)recordId;

+ (id)paramsFromRecordId:(NSString *)recordId file:(NSString *)file;

@end
