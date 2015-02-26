//
//  KBRPCRegistration.h
//  Keybase
//
//  Created by Gabriel on 2/25/15.
//  Copyright (c) 2015 Gabriel Handford. All rights reserved.
//

#import <Foundation/Foundation.h>

#import <MPMessagePack/MPMessagePackServer.h>

@interface KBRPCRegistration : NSObject

- (void)registerMethod:(NSString *)method owner:(id)owner requestHandler:(MPRequestHandler)requestHandler;

- (void)unregister:(id)owner;

- (MPRequestHandler)requestHandlerForMethod:(NSString *)method;

@end
