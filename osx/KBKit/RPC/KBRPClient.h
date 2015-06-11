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

typedef NS_ENUM (NSInteger, KBRPClientStatus) {
  KBRPClientStatusClosed,
  KBRPClientStatusOpening,
  KBRPClientStatusOpen
};

typedef void (^KBRPClientOnPassphrase)(NSString *passphrase);
typedef void (^KBRPClientOnSecret)(NSString *secret);

@class KBRPClient;

@protocol KBRPClientDelegate
- (void)RPClientWillConnect:(KBRPClient *)RPClient;
- (void)RPClientDidConnect:(KBRPClient *)RPClient;
- (void)RPClientDidDisconnect:(KBRPClient *)RPClient;
- (void)RPClient:(KBRPClient *)RPClient didErrorOnConnect:(NSError *)error connectAttempt:(NSInteger)connectAttempt;

- (void)RPClient:(KBRPClient *)RPClient didLog:(NSString *)message;

- (void)RPClient:(KBRPClient *)RPClient didRequestSecretForPrompt:(NSString *)prompt info:(NSString *)info details:(NSString *)details previousError:(NSString *)previousError completion:(KBRPClientOnSecret)completion;
- (void)RPClient:(KBRPClient *)RPClient didRequestKeybasePassphraseForUsername:(NSString *)username completion:(KBRPClientOnPassphrase)completion;
@end

@interface KBRPClient : NSObject <MPMessagePackClientDelegate>

@property (weak) id<KBRPClientDelegate> delegate;
@property (getter=isAutoRetryDisabled) BOOL autoRetryDisabled;

@property (readonly) KBEnvConfig *config;
@property (readonly) KBRPClientStatus status;

- (instancetype)initWithConfig:(KBEnvConfig *)config;

- (void)sendRequestWithMethod:(NSString *)method params:(NSDictionary *)params sessionId:(NSInteger)sessionId completion:(MPRequestCompletion)completion;
- (void)registerMethod:(NSString *)method sessionId:(NSInteger)sessionId requestHandler:(MPRequestHandler)requestHandler;
- (void)unregister:(NSInteger)sessionId;
- (NSInteger)nextSessionId;

- (void)open;

- (void)open:(void (^)(NSError *error))completion;

- (void)close;

- (void)check:(void (^)(NSError *error, NSString *version))completion;
- (void)openAndCheck:(void (^)(NSError *error, NSString *version))completion;

@end

@interface KBRPCCoder : NSObject <MPMessagePackCoder>
@end

