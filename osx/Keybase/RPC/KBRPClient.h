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

@protocol KBRPClient;

@protocol KBRPClientDelegate
- (void)RPClientDidConnect:(id<KBRPClient>)RPClient;
- (void)RPClientDidDisconnect:(id<KBRPClient>)RPClient;
- (void)RPClient:(id<KBRPClient>)RPClient didErrorOnConnect:(NSError *)error connectAttempt:(NSInteger)connectAttempt;
@end

@protocol KBRPClient
@property (weak) id<KBRPClientDelegate> delegate;

- (void)open;
- (void)checkInstall:(KBCompletionBlock)completion;

- (void)sendRequestWithMethod:(NSString *)method params:(id)params sessionId:(NSInteger)sessionId completion:(MPRequestCompletion)completion;
- (void)registerMethod:(NSString *)method sessionId:(NSInteger)sessionId requestHandler:(MPRequestHandler)requestHandler;
- (void)unregister:(NSInteger)sessionId;
- (NSInteger)nextSessionId;
@end


@interface KBRPClient : NSObject <KBRPClient, MPMessagePackClientDelegate>

@property (weak) id<KBRPClientDelegate> delegate;
@property (getter=isAutoRetryDisabled) BOOL autoRetryDisabled;

- (void)open;

- (void)open:(void (^)(NSError *error))completion;

- (void)close;

- (void)check:(void (^)(NSError *error))completion;
- (void)openAndCheck:(void (^)(NSError *error))completion;

- (void)checkInstall:(KBCompletionBlock)completion;

@end

@interface KBRPCCoder : NSObject <MPMessagePackCoder>
@end

