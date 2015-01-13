//
//  KBProofsView.m
//  Keybase
//
//  Created by Gabriel on 1/9/15.
//  Copyright (c) 2015 Gabriel Handford. All rights reserved.
//

#import "KBProofsView.h"

#import "KBItemsLabel.h"

@interface KBProofsView ()
@property KBUser *user;
@property NSMutableArray /*KBItemsLabel*/*proofLabels;
@end


@implementation KBProofsView

- (void)viewInit {
  [super viewInit];
  _proofLabels = [NSMutableArray array];

  YOSelf yself = self;
  self.viewLayout = [YOLayout layoutWithLayoutBlock:^(id<YOLayout> layout, CGSize size) {
    CGFloat y = 0;

    for (KBItemsLabel *label in yself.proofLabels) {
      y += [layout setFrame:CGRectMake(15, y, 305, 0) view:label sizeToFit:YES].size.height + 8;
    }

    return CGSizeMake(size.width, y);
  }];
}

+ (KBItemsLabel *)labelWithHeaderText:(NSString *)headerText user:(KBUser *)user proofType:(KBProofType)proofType placeHolder:(NSString *)placeHolder targetBlock:(KBProofSelectBlock)targetBlock {
  KBItemsLabel *label = [[KBItemsLabel alloc] init];
  NSArray *proofs = [user proofsForType:proofType];
  if ([proofs count] == 0 && !placeHolder) return nil;
  NSArray *texts = [proofs map:^id(KBProof *proof) {
    return [proof displayName];
  }];
  [label setHeaderText:headerText items:proofs texts:texts font:nil placeHolder:placeHolder targetBlock:^(id sender, KBProof *proof) {
    targetBlock(proofType, proof);
  }];
  return label;
}

- (void)addLabels:(NSArray *)labels {
  for (NSView *label in labels) {
    [_proofLabels addObject:label];
    [self addSubview:label];
  }
}

- (void)clearLabels {
  for (KBItemsLabel *label in _proofLabels) [label removeFromSuperview];
  [_proofLabels removeAllObjects];
}

+ (NSArray *)labelsForUser:(KBUser *)user editableTypes:(NSSet *)editableTypes targetBlock:(KBProofSelectBlock)targetBlock {
  NSMutableArray *labels = [NSMutableArray array];
  [labels gh_addObject:[KBProofsView labelWithHeaderText:@"Twitter" user:user proofType:KBProofTypeTwitter placeHolder:([editableTypes containsObject:@(KBProofTypeTwitter)] ? @"Prove my Twitter identity" : nil) targetBlock:targetBlock]];

  [labels gh_addObject:[KBProofsView labelWithHeaderText:@"Github" user:user proofType:KBProofTypeGithub placeHolder:([editableTypes containsObject:@(KBProofTypeGithub)] ? @"Prove my Github identity" : nil) targetBlock:targetBlock]];

  [labels gh_addObject:[KBProofsView labelWithHeaderText:@"Reddit" user:user proofType:KBProofTypeReddit placeHolder:([editableTypes containsObject:@(KBProofTypeReddit)] ? @"Prove my Reddit identity" : nil) targetBlock:targetBlock]];

  [labels gh_addObject:[KBProofsView labelWithHeaderText:@"Coinbase" user:user proofType:KBProofTypeCoinbase placeHolder:([editableTypes containsObject:@(KBProofTypeCoinbase)] ? @"Prove my Coinbase identity" : nil) targetBlock:targetBlock]];

  [labels gh_addObject:[KBProofsView labelWithHeaderText:@"Hacker News" user:user proofType:KBProofTypeHackerNews placeHolder:([editableTypes containsObject:@(KBProofTypeHackerNews)] ? @"Prove my Hacker News identity" : nil) targetBlock:targetBlock]];

  [labels gh_addObject:[KBProofsView labelWithHeaderText:@"HTTPS" user:user proofType:KBProofTypeGenericWebSite placeHolder:nil targetBlock:targetBlock]];

  [labels gh_addObject:[KBProofsView labelWithHeaderText:@"DNS" user:user proofType:KBProofTypeDNS placeHolder:nil targetBlock:targetBlock]];

  return labels;
}

- (void)setUser:(KBUser *)user editableTypes:(NSSet *)editableTypes {
  self.user = user;
  [self clearLabels];

  NSArray *labels = [KBProofsView labelsForUser:user editableTypes:editableTypes targetBlock:^(KBProofType proofType, KBProof *proof) {

  }];
  [self addLabels:labels];

  [self setNeedsLayout];
}


@end
