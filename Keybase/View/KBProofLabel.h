//
//  KBProofLabel.h
//  Keybase
//
//  Created by Gabriel on 1/22/15.
//  Copyright (c) 2015 Gabriel Handford. All rights reserved.
//

#import <Foundation/Foundation.h>

#import "KBUIDefines.h"
#import "KBProofResult.h"
#import "KBRPC.h"

@interface KBProofLabel : KBButton

@property (nonatomic) KBProofResult *proofResult;

+ (KBProofLabel *)labelWithProofResult:(KBProofResult *)proofResult targetBlock:(void (^)(id sender))targetBlock;

@end
