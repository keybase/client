//
//  KBUserInfoView.m
//  Keybase
//
//  Created by Gabriel on 1/9/15.
//  Copyright (c) 2015 Gabriel Handford. All rights reserved.
//

#import "KBUserInfoView.h"

#import "KBUserInfoLabels.h"
#import "KBRPC.h"
#import "KBProofResult.h"
#import <MPMessagePack/MPMessagePack.h>
#import "KBWebView.h"

@interface KBUserInfoView ()
@property NSMutableArray /*KBItemsLabel*/*labels;
@end


@implementation KBUserInfoView

- (void)viewInit {
  [super viewInit];
  _labels = [NSMutableArray array];

  YOSelf yself = self;
  self.viewLayout = [YOLayout layoutWithLayoutBlock:^(id<YOLayout> layout, CGSize size) {
    CGFloat y = 0;

    for (KBUserInfoLabels *label in yself.labels) {
      y += [layout sizeToFitVerticalInFrame:CGRectMake(20, y, size.width - 40, 0) view:label].size.height + 8;
    }
    return CGSizeMake(size.width, y);
  }];
}

- (void)addLabels:(NSArray *)labels {
  for (NSView *label in labels) {
    [_labels addObject:label];
    [self addSubview:label];
  }
  [self setNeedsLayout];
}

- (void)clear {
  for (KBUserInfoLabels *label in _labels) [label removeFromSuperview];
  [_labels removeAllObjects];
  [self setNeedsLayout];
}

- (BOOL)updateProofResult:(KBProofResult *)proofResult {
  BOOL updated = NO;
  for (KBUserInfoLabels *label in _labels) {
    if ([label findLabelForSigId:proofResult.proof.sigId]) {
      [label updateProofResult:proofResult];
      updated = YES;
    }
  }
  if (!updated) {
    DDLogDebug(@"Proof result not found: %@", proofResult);
  }
  return updated;
}

- (NSArray *)missingProveTypes {
  NSMutableArray *proveTypes = [@[@(KBProveTypeTwitter), @(KBProveTypeGithub), @(KBProveTypeReddit), @(KBProveTypeCoinbase), @(KBProveTypeHackernews),] mutableCopy];

  for (KBUserInfoLabels *label in _labels) {
    for (KBProofResult *proofResult in label.proofResults) {
      [proveTypes removeObject:@(KBProveTypeFromAPI([[proofResult proof] proofType]))];
    }
  }

  // We can always add more of these types
  [proveTypes addObjectsFromArray:@[@(KBProveTypeHTTPS), @(KBProveTypeDNS)]];

  return proveTypes;
}

- (void)addHeader:(NSString *)header text:(NSString *)text targetBlock:(dispatch_block_t)targetBlock {
  KBUserInfoLabels *label = [[KBUserInfoLabels alloc] init];
  [label addHeader:header text:text targetBlock:targetBlock];
  [self addLabels:@[label]];
}

- (void)addKey:(KBRFOKID *)key targetBlock:(void (^)(KBRFOKID *key))targetBlock {
  KBUserInfoLabels *label = [[KBUserInfoLabels alloc] init];
  [label addKey:key targetBlock:^(id sender, KBRFOKID *key) {
    targetBlock(key);
  }];
  [self addLabels:@[label]];
}

- (void)addCryptocurrency:(KBRCryptocurrency *)cryptocurrency targetBlock:(void (^)(KBRCryptocurrency *cryptocurrency))targetBlock {
  KBUserInfoLabels *label = [[KBUserInfoLabels alloc] init];
  [label addCryptocurrency:cryptocurrency targetBlock:^(id sender, KBRCryptocurrency *proofResult) {
    DDLogDebug(@"Selected: %@", cryptocurrency);
    targetBlock(cryptocurrency);
  }];
  [self addLabels:@[label]];
}

- (void)addProofs:(NSArray *)proofs editable:(BOOL)editable targetBlock:(void (^)(KBProofLabel *proofLabel))targetBlock {
  MPOrderedDictionary *results = [MPOrderedDictionary dictionary];
  for (KBRIdentifyRow *row in proofs) {
    [results addObject:[KBProofResult proofResultForProof:row.proof result:nil] forKey:@(KBProveTypeFromAPI(row.proof.proofType))];
  }

  for (id key in results) {
    NSArray *proofResults = results[key];
    KBUserInfoLabels *label = [[KBUserInfoLabels alloc] init];
    [label addProofResults:proofResults proveType:[key integerValue] editable:editable targetBlock:targetBlock];
    [self addLabels:@[label]];
  }

  [self setNeedsLayout];
}

@end
