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

@interface KBRPClient ()
@property MPMessagePackClient *client;
@property MPMessagePackServer *server;
@property NSMutableDictionary *methods;
@end

@interface KBMantleCoder : NSObject <MPMessagePackCoder>
@end

@implementation KBMantleCoder
- (NSDictionary *)encodeObject:(id)obj {
  return [obj conformsToProtocol:@protocol(MTLJSONSerializing)] ? [MTLJSONAdapter JSONDictionaryFromModel:obj] : obj;
}
@end

@implementation KBRPClient

- (void)open {
  _client = [[MPMessagePackClient alloc] initWithName:@"KBRPClient" options:MPMessagePackOptionsFramed];
  _client.delegate = self;
  _methods = [NSMutableDictionary dictionary];
  
  GHWeakSelf blockSelf = self;
  _client.requestHandler = ^(NSString *method, NSArray *params, MPRequestCompletion completion) {
    GHDebug(@"Received request: %@(%@)", method, [params join:@", "]);
    MPRequestHandler requestHandler = blockSelf.methods[method];
    if (!requestHandler) {
      completion(KBMakeError(-1, @"Method not found", @"Method not found: %@", method), nil);
      return;
    }
    requestHandler(method, params, completion);
  };

  _client.coder = [[KBMantleCoder alloc] init];
  
  NSString *user = [NSProcessInfo.processInfo.environment objectForKey:@"USER"];
  NSAssert(user, @"No user");
  
  GHDebug(@"Connecting to keybased (%@)...", user);
  [_client openWithSocket:NSStringWithFormat(@"/tmp/keybase-%@/keybased.sock", user) completion:^(NSError *error) {
    if (error) {
      GHDebug(@"Error connecting to keybased: %@", error);
      // Retry
      [self openAfterDelay:2];
      return;
    }
    
    [self.delegate RPClientDidConnect:self];
  }];
}

- (void)registerMethod:(NSString *)method requestHandler:(MPRequestHandler)requestHandler {
  _methods[method] = requestHandler;
}

- (void)openAfterDelay:(NSTimeInterval)delay {
  dispatch_after(dispatch_time(DISPATCH_TIME_NOW, 2 * NSEC_PER_SEC), dispatch_get_main_queue(), ^{
    [self open];
  });
}

- (void)logout {
  KBRLogin *login = [[KBRLogin alloc] initWithClient:self];
  [login logout:^(NSError *error) {
    // TODO: check error
    [self.delegate RPClientDidLogout:self];
  }];
}

- (void)sendRequestWithMethod:(NSString *)method params:(NSArray *)params completion:(MPRequestCompletion)completion {
  GHDebug(@"Send request: %@(%@)", method, [params join:@", "]);
  if (_client.status != MPMessagePackClientStatusOpen) {
    completion(KBMakeError(-400, @"We are unable to connect to the keybased client.", @""), nil);
    return;
  }
        
  [_client sendRequestWithMethod:method params:params completion:completion];
}

#pragma mark -

- (void)client:(MPMessagePackClient *)client didError:(NSError *)error fatal:(BOOL)fatal {
  GHDebug(@"Error (%d): %@", fatal, error);
}

- (void)client:(MPMessagePackClient *)client didChangeStatus:(MPMessagePackClientStatus)status {
  if (status == MPMessagePackClientStatusClosed) {
    [self openAfterDelay:2];
  } else if (status == MPMessagePackClientStatusOpen) {
    
  }
}

- (void)client:(MPMessagePackClient *)client didReceiveNotificationWithMethod:(NSString *)method params:(id)params {
  GHDebug(@"Notification: %@(%@)", method, [params join:@","]);
}

@end
