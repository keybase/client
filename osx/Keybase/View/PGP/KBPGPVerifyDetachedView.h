//
//  KBPGPVerifyDetachedView.h
//  Keybase
//
//  Created by Gabriel on 6/5/15.
//  Copyright (c) 2015 Gabriel Handford. All rights reserved.
//

#import <Foundation/Foundation.h>

#import "KBContentView.h"

@class KBPGPVerifyDetachedView;

typedef void (^KBPGPOnDetachedVerify)(KBPGPVerifyDetachedView *view, KBRPgpSigVerification *verification);

@interface KBPGPVerifyDetachedView : KBContentView

@property (copy) KBPGPOnDetachedVerify onVerify;

@end

