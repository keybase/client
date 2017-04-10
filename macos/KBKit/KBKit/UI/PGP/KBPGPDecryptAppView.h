//
//  KBPGPDecryptAppView.h
//  Keybase
//
//  Created by Gabriel on 4/27/15.
//  Copyright (c) 2015 Gabriel Handford. All rights reserved.
//

#import <Foundation/Foundation.h>

#import <Tikppa/Tikppa.h>
#import "KBRPC.h"

@interface KBPGPDecryptAppView : YOView

@property KBNavigationView *navigation;
@property (nonatomic) KBRPClient *client;

@end
