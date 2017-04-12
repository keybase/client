//
//  KBUserInfoLabels.h
//  Keybase
//
//  Created by Gabriel on 1/9/15.
//  Copyright (c) 2015 Gabriel Handford. All rights reserved.
//

#import <Foundation/Foundation.h>


#import "KBRPC.h"
#import "KBProofResult.h"
#import "KBProofLabel.h"

@interface KBUserInfoLabels : YOView

@property (readonly) NSArray *proofResults;

- (void)addProofResults:(NSArray *)proofResults serviceName:(NSString *)serviceName editable:(BOOL)editable targetBlock:(void (^)(KBProofLabel *proofLabel))targetBlock;

- (void)addKey:(KBRIdentifyKey *)key targetBlock:(void (^)(id sender, KBRIdentifyKey *key))targetBlock;

- (void)addCryptocurrency:(KBRCryptocurrency *)cryptocurrency targetBlock:(void (^)(id sender, id object))targetBlock;

- (void)updateProofResult:(KBProofResult *)proofResult;

- (KBProofLabel *)findLabelForSigId:(NSString *)sigId;

- (void)addHeader:(NSAttributedString *)header text:(NSAttributedString *)text targetBlock:(dispatch_block_t)targetBlock;

@end
