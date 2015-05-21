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
#import "KBContentView.h"
#import "KBProofResult.h"

typedef void (^KBProveCompletion)(BOOL success);

@interface KBProveView : KBContentView

@property KBProveInputView *inputView;
@property KBProveInstructionsView *instructionsView;

+ (void)connectWithProveType:(KBRProofType)proveType proofResult:(KBProofResult *)proofResult client:(KBRPClient *)client sender:(NSView *)sender completion:(KBProveCompletion)completion;

@end
