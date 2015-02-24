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
- (void)RPClient:(KBRPClient *)RPClient didErrorOnConnect:(NSError *)error connectAttempt:(NSInteger)connectAttempt;
@end


@interface KBRPClient : NSObject <MPMessagePackClientDelegate>

@property (weak) id<KBRPClientDelegate> delegate;

@property (getter=isAutoRetryDisabled) BOOL autoRetryDisabled;

- (void)open;

- (void)open:(void (^)(NSError *error))completion;

- (void)close;

- (void)check:(void (^)(NSError *error))completion;
- (void)openAndCheck:(void (^)(NSError *error))completion;

- (void)registerMethod:(NSString *)method owner:(id)owner requestHandler:(MPRequestHandler)requestHandler;

- (void)unregister:(id)owner;

- (void)sendRequestWithMethod:(NSString *)method params:(id)params completion:(MPRequestCompletion)completion;


#pragma mark Debug

- (void)replayRecordId:(NSString *)recordId;

- (void)paramsFromRecordId:(NSString *)recordId file:(NSString *)file completion:(void (^)(NSArray *params))completion;

@end
