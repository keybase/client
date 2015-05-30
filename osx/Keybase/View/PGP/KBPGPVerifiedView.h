//
//  KBPGPVerifiedView.h
//  Keybase
//
//  Created by Gabriel on 4/24/15.
//  Copyright (c) 2015 Gabriel Handford. All rights reserved.
//

#import <Foundation/Foundation.h>

#import "KBAppDefines.h"
#import "KBRPC.h"

@interface KBPGPVerifiedView : YOView

@property (nonatomic) KBRPgpSigVerification *pgpSigVerification;

@end
