//
//  KBUsersAppView.h
//  Keybase
//
//  Created by Gabriel on 2/6/15.
//  Copyright (c) 2015 Gabriel Handford. All rights reserved.
//

#import <Foundation/Foundation.h>

#import <Tikppa/Tikppa.h>
#import "KBRPC.h"
#import "KBSearchControl.h"

@interface KBUsersAppView : YOView <KBSearchControlDelegate>

@property KBRPClient *client;

@end
