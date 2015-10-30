//
//  KBPGPVerifyDetachedView.h
//  Keybase
//
//  Created by Gabriel on 6/5/15.
//  Copyright (c) 2015 Gabriel Handford. All rights reserved.
//

#import <Foundation/Foundation.h>

#import <Tikppa/Tikppa.h>
#import "KBRPC.h"

@class KBPGPVerifyDetachedView;

typedef void (^KBPGPOnDetachedVerify)(KBPGPVerifyDetachedView *view, KBRPGPSigVerification *verification);

@interface KBPGPVerifyDetachedView : YOView

@property KBNavigationView *navigation;
@property KBRPClient *client;

@property (copy) KBPGPOnDetachedVerify onVerify;

@end

