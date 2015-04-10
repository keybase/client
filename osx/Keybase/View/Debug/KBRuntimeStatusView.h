//
//  KBRuntimeStatusView.h
//  Keybase
//
//  Created by Gabriel on 3/5/15.
//  Copyright (c) 2015 Gabriel Handford. All rights reserved.
//

#import <Foundation/Foundation.h>

#import "KBAppKit.h"
#import "KBRPC.h"

@interface KBRuntimeStatusView : KBLabel

@property KBRPClient *client;
@property KBRConfig *config;
@property BOOL RPCConnected;

- (void)update;

@end
