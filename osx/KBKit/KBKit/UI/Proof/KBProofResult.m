//
//  KBProofResult.m
//  Keybase
//
//  Created by Gabriel on 1/22/15.
//  Copyright (c) 2015 Gabriel Handford. All rights reserved.
//

#import "KBProofResult.h"

#import <GHKit/GHKit.h>
#import <KBKit/KBFormatter.h>

@implementation KBProofResult

+ (instancetype)proofResultForProof:(KBRRemoteProof *)proof result:(KBRLinkCheckResult *)result {
  KBProofResult *label = [[KBProofResult alloc] init];
  label.proof = proof;
  label.result = result;
  return label;
}

- (NSString *)description {
  return KBDescription(self);
}

@end
