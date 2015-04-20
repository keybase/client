//
//  KBHelperClient.h
//  Keybase
//
//  Created by Gabriel on 4/16/15.
//  Copyright (c) 2015 Gabriel Handford. All rights reserved.
//

#import <Foundation/Foundation.h>

#import "KBDefines.h"

@interface KBHelperClient : NSObject

- (BOOL)connect:(NSError **)error;

- (BOOL)install:(NSError **)error;

- (void)sendRequest:(NSDictionary *)request completion:(void (^)(NSError *error, NSDictionary *response))completion;

@end
