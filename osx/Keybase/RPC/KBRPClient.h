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
#import "KBInstaller.h"

@protocol KBRPClient;

typedef NS_ENUM (NSInteger, KBRPClientStatus) {
  KBRPClientStatusClosed,
  KBRPClientStatusOpening,
  KBRPClientStatusOpen
};

@class KBRPClient;

@protocol KBRPClientDelegate
- (void)RPClientWillConnect:(KBRPClient *)RPClient;
- (void)RPClientDidConnect:(KBRPClient *)RPClient;
- (void)RPClientDidDisconnect:(KBRPClient *)RPClient;
- (void)RPClient:(KBRPClient *)RPClient didErrorOnConnect:(NSError *)error connectAttempt:(NSInteger)connectAttempt;
@end

@interface KBRPClient : NSObject <MPMessagePackClientDelegate>

@property (weak) id<KBRPClientDelegate> delegate;
@property (getter=isAutoRetryDisabled) BOOL autoRetryDisabled;

@property (readonly) KBInstaller *installer;

@property (readonly) NSString *defaultSocketPath;
@property (readonly) NSString *socketPath;

- (void)sendRequestWithMethod:(NSString *)method params:(id)params sessionId:(NSInteger)sessionId completion:(MPRequestCompletion)completion;
- (void)registerMethod:(NSString *)method sessionId:(NSInteger)sessionId requestHandler:(MPRequestHandler)requestHandler;
- (void)unregister:(NSInteger)sessionId;
- (NSInteger)nextSessionId;

- (void)open;

- (void)open:(void (^)(NSError *error))completion;

- (void)close;

- (void)check:(void (^)(NSError *error, NSString *version))completion;
- (void)openAndCheck:(void (^)(NSError *error, NSString *version))completion;

- (void)checkInstall:(KBCompletionBlock)completion;

@end

@interface KBRPCCoder : NSObject <MPMessagePackCoder>
@end

