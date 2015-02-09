//
//  KBProofLabel.h
//  Keybase
//
//  Created by Gabriel on 1/22/15.
//  Copyright (c) 2015 Gabriel Handford. All rights reserved.
//

#import <Foundation/Foundation.h>

#import "KBRPC.h"

@interface KBProofResult : NSObject

+ (instancetype)proofResultForProof:(KBRRemoteProof *)proof result:(KBRLinkCheckResult *)result;

@property KBRRemoteProof *proof;
@property KBRLinkCheckResult *result;

@end
