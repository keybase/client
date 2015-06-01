//
//  KBUserInfoView.h
//  Keybase
//
//  Created by Gabriel on 1/9/15.
//  Copyright (c) 2015 Gabriel Handford. All rights reserved.
//

#import <Foundation/Foundation.h>

#import "KBAppDefines.h"
#import "KBProofResult.h"
#import "KBProofLabel.h"

@interface KBUserInfoView : YOView

- (BOOL)updateProofResult:(KBProofResult *)proofResult;

- (void)addKey:(KBRFOKID *)key targetBlock:(void (^)(KBRFOKID *key))targetBlock;

- (void)addCryptocurrency:(KBRCryptocurrency *)cryptocurrency targetBlock:(void (^)(KBRCryptocurrency *cryptocurrency))targetBlock;

- (void)addProofs:(NSArray *)proofs editable:(BOOL)editable targetBlock:(void (^)(KBProofLabel *proofLabel))targetBlock;

- (void)clear;

- (void)addHeader:(NSString *)header text:(NSString *)text targetBlock:(dispatch_block_t)targetBlock;

- (NSArray */*of NSString*/)missingServices;

@end
