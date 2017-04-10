//
//  KBProofLabel.h
//  Keybase
//
//  Created by Gabriel on 1/22/15.
//  Copyright (c) 2015 Gabriel Handford. All rights reserved.
//

#import <Foundation/Foundation.h>

#import <Tikppa/Tikppa.h>
#import "KBProofResult.h"
#import "KBRPC.h"

@interface KBProofLabel : KBLabel

@property (nonatomic) KBProofResult *proofResult;
@property BOOL editable;

+ (KBProofLabel *)labelWithProofResult:(KBProofResult *)proofResult editable:(BOOL)editable;

@end
