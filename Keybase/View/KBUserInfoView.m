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
}

- (void)clear {
  for (KBUserInfoLabels *label in _labels) [label removeFromSuperview];
  [_labels removeAllObjects];
  [self setNeedsLayout];
}

- (void)updateProofResult:(KBProofResult *)proofResult {
  for (KBUserInfoLabels *label in _labels) {
    if ([label findLabelForProofResult:proofResult]) {
      [label updateProofResult:proofResult];
    }
  }
}

- (void)addIdentityProofs:(NSArray *)identityProofs {
  MPOrderedDictionary *labels = [MPOrderedDictionary dictionary];
  for (KBRIdentifyRow *row in identityProofs) {
    if (row.proof.proofType == 2) [labels addObject:[KBProofResult proofResultForProof:row.proof result:nil] forKey:@"Twitter"];
    else if (row.proof.proofType == 3) [labels addObject:[KBProofResult proofResultForProof:row.proof result:nil] forKey:@"Github"];
    else if (row.proof.proofType == 1000) [labels addObject:[KBProofResult proofResultForProof:row.proof result:nil] forKey:@"HTTP"];
    else if (row.proof.proofType == 1001) [labels addObject:[KBProofResult proofResultForProof:row.proof result:nil] forKey:@"DNS"];
    else if (row.proof.proofType == 4) [labels addObject:[KBProofResult proofResultForProof:row.proof result:nil] forKey:@"Reddit"];
    else if (row.proof.proofType == 5) [labels addObject:[KBProofResult proofResultForProof:row.proof result:nil] forKey:@"Coinbase"];
    else if (row.proof.proofType == 6) [labels addObject:[KBProofResult proofResultForProof:row.proof result:nil] forKey:@"HN"];
  }
  //GHDebug(@"labels: %@", labels);
  for (id key in labels) {
    NSArray *proofResults = labels[key];
    KBUserInfoLabels *label = [[KBUserInfoLabels alloc] init];
    [label setHeaderText:key proofResults:proofResults targetBlock:^(id sender, KBProofResult *proofResult) {
      GHDebug(@"Selected: %@", proofResult);
    }];
    [self addLabels:@[label]];
  }

  [self setNeedsLayout];
}


@end
