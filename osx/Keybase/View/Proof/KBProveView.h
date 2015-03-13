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

typedef void (^KBProveCompletion)(BOOL canceled);

@interface KBProveView : KBContentView

@property (nonatomic) KBProveType proveType;

@property (copy) KBProveCompletion completion;

@property KBProveInputView *inputView;
@property KBProveInstructionsView *instructionsView;

+ (void)connectWithProveType:(KBProveType)proveType client:(KBRPClient *)client sender:(NSView *)sender completion:(KBProveCompletion)completion;

@end
