//
//  KBUserInfoLabels.h
//  Keybase
//
//  Created by Gabriel on 1/9/15.
//  Copyright (c) 2015 Gabriel Handford. All rights reserved.
//

#import <Foundation/Foundation.h>

#import "KBUIDefines.h"
#import "KBRPC.h"
#import "KBProofResult.h"
#import "KBProofLabel.h"
#import "KBProveView.h"

@interface KBUserInfoLabels : YONSView

@property (readonly) NSArray *proofResults;

- (void)addProofResults:(NSArray *)proofResults proveType:(KBProveType)proveType targetBlock:(void (^)(KBProofLabel *proofLabel))targetBlock;

- (void)addKey:(KBRFOKID *)key targetBlock:(void (^)(id sender, id object))targetBlock;

- (void)addCryptocurrency:(KBRCryptocurrency *)cryptocurrency targetBlock:(void (^)(id sender, id object))targetBlock;

- (void)updateProofResult:(KBProofResult *)proofResult;

- (KBProofLabel *)findLabelForSigId:(KBRSIGID *)sigId;

- (void)addConnectWithTypeName:(NSString *)typeName targetBlock:(dispatch_block_t)targetBlock;

@end
