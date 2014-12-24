//
//  KBRPClient.m
//  Keybase
//
//  Created by Gabriel on 12/15/14.
//  Copyright (c) 2014 Gabriel Handford. All rights reserved.
//

#import "KBRPClient.h"
#import "KBRPC.h"

#import <MPMessagePack/MPMessagePackServer.h>
#import <GHKit/GHKit.h>

@interface KBRPClient ()
@property MPMessagePackClient *client;

@property MPMessagePackServer *server;
@end

@implementation KBRPClient

- (void)open {
  _client = [[MPMessagePackClient alloc] initWithName:@"KBRPClient" options:MPMessagePackOptionsFramed];
  _client.delegate = self;
  //[_client openWithHost:@"localhost" port:41111 completion:completion];
  NSError *error = nil;
  GHDebug(@"Connecting to keybased...");
  if (![_client openWithSocket:@"/tmp/keybase-gabe/keybased.sock" error:&error]) {
    GHDebug(@"Error connecting to keybased: %@", error);
    
    // Retry
    [self openAfterDelay:2];
  }
}

- (void)openAfterDelay:(NSTimeInterval)delay {
  dispatch_after(dispatch_time(DISPATCH_TIME_NOW, 2 * NSEC_PER_SEC), dispatch_get_main_queue(), ^{
    [self open];
  });
}

- (void)sendRequestWithMethod:(NSString *)method params:(id)params completion:(MPRequestCompletion)completion {
  if (_client.status != MPMessagePackClientStatusOpen) {
    completion(KBMakeError(-400, @"We are unable to connect to the keybased client.", @""), nil);
    return;
  }
        
  [_client sendRequestWithMethod:method params:params completion:completion];
}

#pragma mark -

- (void)client:(MPMessagePackClient *)client didError:(NSError *)error fatal:(BOOL)fatal {
  
}

- (void)client:(MPMessagePackClient *)client didChangeStatus:(MPMessagePackClientStatus)status {
  if (status == MPMessagePackClientStatusClosed) {
    [self openAfterDelay:2];
  }
}

- (void)client:(MPMessagePackClient *)client didReceiveNotificationWithMethod:(NSString *)method params:(id)params {
  
}

@end
