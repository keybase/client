//
//  KBUserInfoView.h
//  Keybase
//
//  Created by Gabriel on 1/9/15.
//  Copyright (c) 2015 Gabriel Handford. All rights reserved.
//

#import <Foundation/Foundation.h>

#import "KBUIDefines.h"
#import "KBProofResult.h"

@interface KBUserInfoView : KBView

- (void)updateProofResult:(KBProofResult *)proofResult;

- (void)addIdentityProofs:(NSArray *)identityProofs;

- (void)clear;

@end
