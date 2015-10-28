//
//  KBPGPVerifiedView.h
//  Keybase
//
//  Created by Gabriel on 4/24/15.
//  Copyright (c) 2015 Gabriel Handford. All rights reserved.
//

#import <Foundation/Foundation.h>

#import <Tikppa/Tikppa.h>
#import "KBRPC.h"

@interface KBPGPVerifiedView : YOVBox

@property (nonatomic) KBRPGPSigVerification *pgpSigVerification;

@end
