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

@protocol KBRPClient
- (NSArray *)sendRequestWithMethod:(NSString *)method params:(id)params sessionId:(NSInteger)sessionId completion:(MPRequestCompletion)completion;
- (void)registerMethod:(NSString *)method sessionId:(NSInteger)sessionId requestHandler:(MPRequestHandler)requestHandler;
- (void)unregister:(NSInteger)sessionId;
- (NSInteger)nextSessionId;
@end

@protocol KBRPClientDelegate
- (void)RPClientDidConnect:(KBRPClient *)RPClient;
- (void)RPClientDidDisconnect:(KBRPClient *)RPClient;
- (void)RPClient:(KBRPClient *)RPClient didErrorOnConnect:(NSError *)error connectAttempt:(NSInteger)connectAttempt;
@end


@interface KBRPClient : NSObject <KBRPClient, MPMessagePackClientDelegate>

@property (weak) id<KBRPClientDelegate> delegate;

@property (getter=isAutoRetryDisabled) BOOL autoRetryDisabled;

- (void)open;

- (void)open:(void (^)(NSError *error))completion;

- (void)close;

- (void)check:(void (^)(NSError *error))completion;
- (void)openAndCheck:(void (^)(NSError *error))completion;

@end
