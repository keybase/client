//
//  KBProveInstructionsView.h
//  Keybase
//
//  Created by Gabriel on 2/9/15.
//  Copyright (c) 2015 Gabriel Handford. All rights reserved.
//

#import <Foundation/Foundation.h>

#import "KBAppDefines.h"
#import "KBRPC.h"
#import "KBContentView.h"

@protocol KBProveInstructionsView
@property KBButton *button;
@property KBButton *cancelButton;
- (void)setProofText:(NSString *)proofText serviceName:(NSString *)serviceName;
@end

@interface KBProveInstructionsView : KBContentView <KBProveInstructionsView>

@end

