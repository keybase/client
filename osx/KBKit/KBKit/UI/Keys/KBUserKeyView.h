//
//  KBUserKeyView.h
//  Keybase
//
//  Created by Gabriel on 7/9/15.
//  Copyright (c) 2017 Keybase. All rights reserved.
//

#import <Foundation/Foundation.h>

#import "KBRPC.h"
#import <Tikppa/Tikppa.h>

@interface KBUserKeyView : YOView

@property KBNavigationView *navigation;
@property KBRPClient *client;

@property KBButton *closeButton;

- (void)setIdentifyKey:(KBRIdentifyKey *)identifyKey;

@end
