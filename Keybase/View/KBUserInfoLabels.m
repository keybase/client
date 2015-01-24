//
//  KBUserInfoLabels.m
//  Keybase
//
//  Created by Gabriel on 1/9/15.
//  Copyright (c) 2015 Gabriel Handford. All rights reserved.
//

#import "KBUserInfoLabels.h"

#import "KBProofLabel.h"

@interface KBUserInfoLabels ()
@property KBLabel *headerLabel;
@property KBImageView *imageView;
@property NSMutableArray *labels;
@end

@implementation KBUserInfoLabels

- (void)viewInit {
  [super viewInit];
  _headerLabel = [[KBLabel alloc] init];
  [self addSubview:_headerLabel];

  _imageView = [[KBImageView alloc] init];
  [self addSubview:_imageView];

  _labels = [NSMutableArray array];

  YOSelf yself = self;
  self.viewLayout = [YOLayout layoutWithLayoutBlock:^(id<YOLayout> layout, CGSize size) {
    CGFloat x = (size.width/2.0) - 25;
    CGFloat y = 0;

    if ([yself.headerLabel hasText]) {
      CGSize headerLabelSize = [yself.headerLabel sizeThatFits:size];
      [layout setFrame:CGRectMake(x - headerLabelSize.width, 0, headerLabelSize.width, 25) view:yself.headerLabel];
    }

    if (yself.imageView.image) {
      [layout setFrame:CGRectMake(x - 35, y, 25, 25) view:yself.imageView];
    }

    for (NSView *view in yself.labels) {
      y += [layout setFrame:CGRectMake(x, y, 1000, 25) view:view].size.height;
    }

    return CGSizeMake(size.width, y);
  }];
}

- (void)clearLabels {
  for (NSView *view in _labels) [view removeFromSuperview];
  [_labels removeAllObjects];
}

- (NSString *)imageNameForType:(NSString *)type {
  if ([type isEqualToString:@"Twitter"]) return @"Social networks-Outline-Twitter-25";
  else if ([type isEqualToString:@"Github"]) return @"Social networks-Outline-Github-25";
  else if ([type isEqualToString:@"Reddit"]) return @"Social networks-Outline-Reddit-25";
  else return nil;
}

- (void)updateProofResult:(KBProofResult *)proofResult {
  KBProofLabel *label = [self findLabelForProofResult:proofResult];
  label.proofResult = proofResult;
  [self setNeedsLayout];
}

- (KBProofLabel *)findLabelForProofResult:(KBProofResult *)proofResult {
  for (KBProofLabel *label in _labels) {
    //if ([label.proofResult.proof.sigId isEqual:proofResult.proof.sigId]) return label;
    if (label.proofResult.proof.proofType == proofResult.proof.proofType && [label.proofResult.proof.value isEqual:proofResult.proof.value]) return label;
  }
  return nil;
}

- (void)setHeaderText:(NSString *)headerText proofResults:(NSArray *)proofResults targetBlock:(void (^)(id sender, id object))targetBlock {
  _proofResults = proofResults;
  NSImage *image = [NSImage imageNamed:[self imageNameForType:headerText]];
  _imageView.image = image;

  if (!_imageView.image) {
    [_headerLabel setText:headerText font:[NSFont systemFontOfSize:16] color:[KBLookAndFeel textColor] alignment:NSLeftTextAlignment];
  } else {
    _headerLabel.attributedText = nil;
  }

  [self clearLabels];
  GHWeakSelf blockSelf = self;
  if ([proofResults count] == 0) {
    //[self addLabelWithText:@"Edit" font:[NSFont systemFontOfSize:20] tag:-1 targetBlock:^(id sender) { targetBlock(blockSelf, nil); }];
  } else {
    for (NSInteger index = 0; index < [proofResults count]; index++) {
      KBProofLabel *proofLabel = [KBProofLabel labelWithProofResult:proofResults[index] targetBlock:^(id sender) {
        targetBlock(blockSelf, proofResults[index]);
      }];
      [_labels addObject:proofLabel];
      [self addSubview:proofLabel];
    }
  }

  [self setNeedsLayout];
}

@end
