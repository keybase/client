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

@class KBRPClient;

@protocol KBRPClientDelegate
- (void)RPClientDidConnect:(KBRPClient *)RPClient;
- (void)RPClientDidLogout:(KBRPClient *)RPClient;
@end


@interface KBRPClient : NSObject <MPMessagePackClientDelegate>

@property (weak) id<KBRPClientDelegate> delegate;

- (void)open;

- (void)registerMethod:(NSString *)method requestHandler:(MPRequestHandler)requestHandler;

- (void)sendRequestWithMethod:(NSString *)method params:(id)params completion:(MPRequestCompletion)completion;

// Methods

- (void)checkStatus;

- (void)logout;

@end
