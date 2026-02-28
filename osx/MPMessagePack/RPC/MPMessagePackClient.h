//
//  MPMessagePackRPClient.h
//  MPMessagePack
//
//  Created by Gabriel on 12/12/14.
//  Copyright (c) 2014 Gabriel Handford. All rights reserved.
//

#import <Foundation/Foundation.h>

#import "MPDefines.h"
#import "MPRPCProtocol.h"

typedef NS_ENUM (NSInteger, MPMessagePackClientStatus) {
  MPMessagePackClientStatusNone = 0,
  MPMessagePackClientStatusClosed = 1,
  MPMessagePackClientStatusOpening,
  MPMessagePackClientStatusOpen,
};

typedef NS_OPTIONS (NSInteger, MPMessagePackOptions) {
  MPMessagePackOptionsNone = 0,
  // If true, the message is wrapped in a frame
  MPMessagePackOptionsFramed = 1 << 0,
};

@protocol MPMessagePackCoder
- (nonnull id)encodeObject:(nonnull id)obj;
@end

@class MPMessagePackClient;

@protocol MPMessagePackClientDelegate <NSObject>
- (void)client:(nonnull MPMessagePackClient *)client didError:(nonnull NSError *)error fatal:(BOOL)fatal;
- (void)client:(nonnull MPMessagePackClient *)client didChangeStatus:(MPMessagePackClientStatus)status;
- (void)client:(nonnull MPMessagePackClient *)client didReceiveNotificationWithMethod:(nonnull NSString *)method params:(nonnull NSArray *)params;
@end

@interface MPMessagePackClient : NSObject

@property (nullable, weak) id<MPMessagePackClientDelegate> delegate;
@property (nullable, copy) MPRequestHandler requestHandler;
@property (readonly, nonatomic) MPMessagePackClientStatus status;
@property (nullable) id<MPMessagePackCoder> coder;

- (nonnull instancetype)initWithName:(nonnull NSString *)name options:(MPMessagePackOptions)options;

- (void)openWithHost:(nonnull NSString *)host port:(UInt32)port completion:(nonnull MPCompletion)completion;

- (BOOL)openWithSocket:(nonnull NSString *)unixSocket completion:(nonnull MPCompletion)completion;

- (void)setInputStream:(nonnull NSInputStream *)inputStream outputStream:(nonnull NSOutputStream *)outputStream;

- (void)close;

/*!
 Send RPC request asyncronously with completion block.
 
 @param method Method name
 @param params Method args. If coder is set on client, we will use it to encode.
 @param messageId Unique message identifier. Responses will use this message ID.
 @param completion Response
 */
- (void)sendRequestWithMethod:(nonnull NSString *)method params:(nonnull NSArray *)params messageId:(NSInteger)messageId completion:(nonnull MPRequestCompletion)completion;

/*!
 Send a response.

 @param result Result
 @param error Error
 @param messageId Message ID (will match request message ID)
 */
- (void)sendResponseWithResult:(nullable id)result error:(nullable id)error messageId:(NSInteger)messageId;

/*!
 Send request synchronously.
 
 @param method Method name
 @param params Method args. If coder is set on client, we will use it to encode.
 @param messageId Unique message identifier. Responses will use this message ID.
 @param timeout Timeout
 @param error Out error
 @result Result of method invocation
 */
- (nullable id)sendRequestWithMethod:(nonnull NSString *)method params:(nonnull NSArray *)params messageId:(NSInteger)messageId timeout:(NSTimeInterval)timeout error:(NSError * _Nonnull * _Nonnull)error;

/*!
 Cancel request.
 
 @param messageId Message id
 @result Return YES if cancelled
 */
- (BOOL)cancelRequestWithMessageId:(NSInteger)messageId;

@end


