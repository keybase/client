//
//  KBRRequest.h
//  Keybase
//
//  Created by Gabriel on 12/16/14.
//  Copyright (c) 2014 Gabriel Handford. All rights reserved.
//

#import <Foundation/Foundation.h>

#import "KBRPClient.h"

@interface KBRRequest : NSObject

@property (readonly) KBRPClient *client;

- (instancetype)initWithClient:(KBRPClient *)client;

@end
