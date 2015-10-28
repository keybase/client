//
//  KBProveInstructionsView.h
//  Keybase
//
//  Created by Gabriel on 2/9/15.
//  Copyright (c) 2015 Gabriel Handford. All rights reserved.
//

#import <Foundation/Foundation.h>

#import "KBRPC.h"
#import <Tikppa/Tikppa.h>
#import "KBRPC.h"
#import <Tikppa/Tikppa.h>

@interface KBProveInstructionsView : YOView

@property KBNavigationView *navigation;
@property KBRPClient *client;

@property KBButton *button;
@property KBButton *cancelButton;

- (void)setProofText:(NSString *)proofText serviceName:(NSString *)serviceName;

@end

