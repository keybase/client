//
//  MPMessagePackServer.h
//  MPMessagePack
//
//  Created by Gabriel on 12/13/14.
//  Copyright (c) 2014 Gabriel Handford. All rights reserved.
//

#import <Foundation/Foundation.h>

#import "MPMessagePack.h"
#import "MPMessagePackClient.h"

@interface MPMessagePackServer : NSObject <MPMessagePackClientDelegate>

@property (copy, nonatomic) MPRequestHandler requestHandler;
@property (copy, nonatomic) MPRequestHandler notificationHandler;

- (instancetype)initWithOptions:(MPMessagePackOptions)options;

- (BOOL)openWithPort:(uint16_t)port error:(NSError **)error;

- (void)close;

@end
