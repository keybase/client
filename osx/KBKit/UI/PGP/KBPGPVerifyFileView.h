//
//  KBPGPVerifyFileView.h
//  Keybase
//
//  Created by Gabriel on 3/30/15.
//  Copyright (c) 2015 Gabriel Handford. All rights reserved.
//

#import <Foundation/Foundation.h>

#import <KBAppKit/KBAppKit.h>
#import "KBRPC.h"

@interface KBPGPVerifyFileView : YOView

@property KBNavigationView *navigation;
@property KBRPClient *client;

@end
