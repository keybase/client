//
//  KBUserInfoLabels.h
//  Keybase
//
//  Created by Gabriel on 1/9/15.
//  Copyright (c) 2015 Gabriel Handford. All rights reserved.
//

#import <Foundation/Foundation.h>

#import "KBAppKit.h"
#import "KBRPC.h"
#import "KBProofResult.h"
#import "KBProofLabel.h"
#import "KBProveType.h"

@interface KBUserInfoLabels : YOView

@property (readonly) NSArray *proofResults;

- (void)addProofResults:(NSArray *)proofResults proveType:(KBProveType)proveType editable:(BOOL)editable targetBlock:(void (^)(KBProofLabel *proofLabel))targetBlock;

- (void)addKey:(KBRFOKID *)key targetBlock:(void (^)(id sender, id object))targetBlock;

- (void)addCryptocurrency:(KBRCryptocurrency *)cryptocurrency targetBlock:(void (^)(id sender, id object))targetBlock;

- (void)updateProofResult:(KBProofResult *)proofResult;

- (KBProofLabel *)findLabelForSigId:(NSString *)sigId;

- (void)addHeader:(NSString *)header text:(NSString *)text targetBlock:(dispatch_block_t)targetBlock;

@end
