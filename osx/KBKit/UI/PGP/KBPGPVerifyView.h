//
//  KBPGPVerifyView.h
//  Keybase
//
//  Created by Gabriel on 3/27/15.
//  Copyright (c) 2015 Gabriel Handford. All rights reserved.
//

#import <Foundation/Foundation.h>

#import "KBContentView.h"

@class KBPGPVerifyView;

typedef void (^KBPGPOnVerify)(KBPGPVerifyView *view, KBRPgpSigVerification *verification);

@interface KBPGPVerifyView : KBContentView

@property (copy) KBPGPOnVerify onVerify;

@end
