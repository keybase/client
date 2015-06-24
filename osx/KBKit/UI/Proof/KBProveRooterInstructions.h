//
//  KBProveRooterInstructions.h
//  Keybase
//
//  Created by Gabriel on 6/1/15.
//  Copyright (c) 2015 Gabriel Handford. All rights reserved.
//

#import <Foundation/Foundation.h>

#import <KBAppKit/KBAppKit.h>
#import "KBRPC.h"
#import "KBProveInstructionsView.h"

@interface KBProveRooterInstructions : YOView <KBProveInstructionsView>

@property KBNavigationView *navigation;
@property KBRPClient *client;

@end
