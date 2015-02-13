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
- (void)RPClientDidDisconnect:(KBRPClient *)RPClient;
- (void)RPClient:(KBRPClient *)RPClient didErrorOnConnect:(NSError *)error;
@end


@interface KBRPClient : NSObject <MPMessagePackClientDelegate>

@property (weak) id<KBRPClientDelegate> delegate;

@property (getter=isAutoRetryDisabled) BOOL autoRetryDisabled;

- (void)open;

- (void)close;

- (void)registerMethod:(NSString *)method requestHandler:(MPRequestHandler)requestHandler;

- (void)sendRequestWithMethod:(NSString *)method params:(id)params completion:(MPRequestCompletion)completion;


#pragma mark Debug

- (BOOL)replayRecordId:(NSString *)recordId;

@end
