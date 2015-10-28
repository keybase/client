//
//  KBPGPKeyView.h
//  Keybase
//
//  Created by Gabriel on 3/13/15.
//  Copyright (c) 2015 Gabriel Handford. All rights reserved.
//

#import <Foundation/Foundation.h>

#import "KBRPC.h"
#import <Tikppa/Tikppa.h>

@interface KBKeyView : YOView

@property KBNavigationView *navigation;
@property KBRPClient *client;

@property KBButton *closeButton;

- (void)setIdentifyKey:(KBRIdentifyKey *)identifyKey;

@end
