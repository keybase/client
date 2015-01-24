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

@interface KBUserInfoLabels : YONSView

@property (readonly) NSArray *proofResults;

- (void)setHeaderText:(NSString *)headerText proofResults:(NSArray *)proofResults targetBlock:(void (^)(id sender, id object))targetBlock;

- (void)updateProofResult:(KBProofResult *)proofResult;

- (KBProofLabel *)findLabelForProofResult:(KBProofResult *)proofResult;

@end
