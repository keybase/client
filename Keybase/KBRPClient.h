//
//  KBRPClient.h
//  Keybase
//
//  Created by Gabriel on 12/15/14.
//  Copyright (c) 2014 Gabriel Handford. All rights reserved.
//

#import <Foundation/Foundation.h>

#import "KBDefines.h"
#import <MPMessagePack/MPMessagePackClient.h>

@interface KBRPClient : NSObject

- (void)open:(KBCompletion)completion;

- (void)sendRequestWithMethod:(NSString *)method params:(id)params completion:(MPRequestCompletion)completion;

@end
