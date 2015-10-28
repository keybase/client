//
//  KBDeviceSetupDisplayView.h
//  Keybase
//
//  Created by Gabriel on 3/17/15.
//  Copyright (c) 2015 Gabriel Handford. All rights reserved.
//

#import <Foundation/Foundation.h>

#import <Tikppa/Tikppa.h>
#import "KBRPC.h"

@interface KBDeviceSetupDisplayView : YOView

@property KBNavigationView *navigation;
@property KBRPClient *client;

@property KBButton *button;
@property KBButton *cancelButton;

- (void)setSecretWords:(NSString *)secretWords deviceNameExisting:(NSString *)deviceNameExisting deviceNameToAdd:(NSString *)deviceNameToAdd;

@end
