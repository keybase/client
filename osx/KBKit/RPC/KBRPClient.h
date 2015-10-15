//
//  KBRPClient.h
//  Keybase
//
//  Created by Gabriel on 12/15/14.
//  Copyright (c) 2014 Gabriel Handford. All rights reserved.
//

#import <Foundation/Foundation.h>

#import <MPMessagePack/MPMessagePackClient.h>
#import "KBEnvConfig.h"
#import "KBDefines.h"

typedef NS_ENUM (NSInteger, KBRPClientStatus) {
  KBRPClientStatusClosed,
  KBRPClientStatusOpening,
  KBRPClientStatusOpen
};

typedef NS_OPTIONS (NSInteger, KBRClientOptions) {
  KBRClientOptionsAutoRetry = 1 << 0,
};

typedef void (^KBRPClientOnPassphrase)(NSString *passphrase);
typedef void (^KBRPClientOnSecret)(NSString *secret);

@class KBRPClient;

@protocol KBRPClientDelegate
- (void)RPClientWillConnect:(KBRPClient *)RPClient;
- (void)RPClientDidConnect:(KBRPClient *)RPClient;
- (void)RPClientDidDisconnect:(KBRPClient *)RPClient;

// Return YES to retry, NO to stop
- (BOOL)RPClient:(KBRPClient *)RPClient didErrorOnConnect:(NSError *)error connectAttempt:(NSInteger)connectAttempt;

- (void)RPClient:(KBRPClient *)RPClient didLog:(NSString *)message;

- (void)RPClient:(KBRPClient *)RPClient didRequestSecretForPrompt:(NSString *)prompt info:(NSString *)info details:(NSString *)details previousError:(NSString *)previousError completion:(KBRPClientOnSecret)completion;
- (void)RPClient:(KBRPClient *)RPClient didRequestKeybasePassphraseForUsername:(NSString *)username completion:(KBRPClientOnPassphrase)completion;
@end

@interface KBRPClient : NSObject <MPMessagePackClientDelegate>

@property (weak) id<KBRPClientDelegate> delegate;

@property (readonly) KBEnvConfig *config;
@property (readonly) KBRPClientStatus status;

- (instancetype)initWithConfig:(KBEnvConfig *)config options:(KBRClientOptions)options;

- (void)sendRequestWithMethod:(NSString *)method params:(NSDictionary *)params messageId:(NSNumber *)messageId completion:(MPRequestCompletion)completion;

// @deprecated
- (void)sendRequestWithMethod:(NSString *)method params:(NSDictionary *)params sessionId:(NSNumber *)sessionId completion:(MPRequestCompletion)completion;
- (void)registerMethod:(NSString *)method sessionId:(NSNumber *)sessionId requestHandler:(MPRequestHandler)requestHandler;
- (void)unregister:(NSNumber *)sessionId;
- (NSNumber *)nextMessageId;

- (void)open:(KBCompletion)completion;

- (void)close;

@end

@interface KBRPCCoder : NSObject <MPMessagePackCoder>
@end

