//
//  KBDebugViews.h
//  Keybase
//
//  Created by Gabriel on 1/16/15.
//  Copyright (c) 2015 Gabriel Handford. All rights reserved.
//

#import <Foundation/Foundation.h>

#import <Tikppa/Tikppa.h>
#import "KBRPC.h"

@interface KBDebugViews : YOView

@property KBRPClient *client;

- (void)open:(id)sender;

@end
