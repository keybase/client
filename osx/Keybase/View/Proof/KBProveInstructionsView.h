//
//  KBProveInstructionsView.h
//  Keybase
//
//  Created by Gabriel on 2/9/15.
//  Copyright (c) 2015 Gabriel Handford. All rights reserved.
//

#import <Foundation/Foundation.h>

#import "KBAppKit.h"
#import "KBRPC.h"
#import "KBProveType.h"
#import "KBContentView.h"

@interface KBProveInstructionsView : KBContentView
@property KBLabel *instructionsLabel;
@property KBTextView *proofView;
@property KBButton *clipboardCopyButton;
@property NSString *proofText;

@property KBButton *button;
@property KBButton *cancelButton;
@property KBButton *deleteButton;

- (void)setInstructions:(KBRText *)instructions proofText:(NSString *)proofText proveType:(KBProveType)proveType;

@end

