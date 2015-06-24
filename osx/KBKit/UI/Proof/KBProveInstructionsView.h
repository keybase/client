//
//  KBProveInstructionsView.h
//  Keybase
//
//  Created by Gabriel on 2/9/15.
//  Copyright (c) 2015 Gabriel Handford. All rights reserved.
//

#import <Foundation/Foundation.h>

#import "KBRPC.h"
#import <KBAppKit/KBAppKit.h>
#import "KBRPC.h"
#import <KBAppKit/KBAppKit.h>

@protocol KBProveInstructionsView
@property KBButton *button;
@property KBButton *cancelButton;
- (void)setProofText:(NSString *)proofText serviceName:(NSString *)serviceName;
@end

@interface KBProveInstructionsView : YOView <KBProveInstructionsView>

@property KBNavigationView *navigation;
@property KBRPClient *client;

@end

