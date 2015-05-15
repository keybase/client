//
//  KBTwitterView.h
//  Keybase
//
//  Created by Gabriel on 1/13/15.
//  Copyright (c) 2015 Gabriel Handford. All rights reserved.
//

#import <Foundation/Foundation.h>

#import "KBAppKit.h"
#import "KBRPC.h"
#import "KBProveInputView.h"
#import "KBProveInstructionsView.h"
#import "KBProveType.h"
#import "KBContentView.h"
#import "KBProofResult.h"

typedef void (^KBProveCompletion)(KBProofResult *proofResult);

@interface KBProveView : KBContentView

@property KBProveInputView *inputView;
@property KBProveInstructionsView *instructionsView;

+ (void)connectWithProveType:(KBProveType)proveType proofResult:(KBProofResult *)proofResult client:(KBRPClient *)client sender:(NSView *)sender completion:(KBProveCompletion)completion;

@end
