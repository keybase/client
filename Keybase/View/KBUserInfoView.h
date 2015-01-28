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
#import "KBProofLabel.h"

@interface KBUserInfoView : YONSView

- (void)updateProofResult:(KBProofResult *)proofResult;

- (void)addKey:(KBRFOKID *)key;

- (void)addCryptocurrency:(KBRCryptocurrency *)cryptocurrency;

- (void)addIdentityProofs:(NSArray *)identityProofs targetBlock:(void (^)(KBProofLabel *proofLabel))targetBlock;

- (void)clear;

@end
