//
//  KBDebugStatusView.h
//  Keybase
//
//  Created by Gabriel on 3/5/15.
//  Copyright (c) 2015 Gabriel Handford. All rights reserved.
//

#import <Foundation/Foundation.h>

#import "KBAppKit.h"
#import "KBRPC.h"

@interface KBDebugStatusView : YOVBox

@property KBRPClient *client;
@property KBRConfig *config;

- (void)setRPCConnected:(BOOL)RPCConnected serverConnected:(BOOL)serverConnected;

@end
