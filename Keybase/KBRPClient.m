//
//  KBRPClient.m
//  Keybase
//
//  Created by Gabriel on 12/15/14.
//  Copyright (c) 2014 Gabriel Handford. All rights reserved.
//

#import "KBRPClient.h"
#import "KBRPC.h"

@interface KBRPClient ()
@property MPMessagePackClient *client;
@end

@implementation KBRPClient

- (void)open:(KBCompletion)completion {
  _client = [[MPMessagePackClient alloc] initWithName:@"KBRPClient" options:MPMessagePackOptionsFramed];
  [_client openWithHost:@"localhost" port:41111 completion:completion];
}

- (void)sendRequestWithMethod:(NSString *)method params:(id)params completion:(MPRequestCompletion)completion {
  NSAssert(_client.status == MPMessagePackClientStatusOpen, @"Not open");
  [_client sendRequestWithMethod:method params:params completion:completion];
}

@end
