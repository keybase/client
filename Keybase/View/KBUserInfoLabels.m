//
//  KBUserInfoLabels.m
//  Keybase
//
//  Created by Gabriel on 1/9/15.
//  Copyright (c) 2015 Gabriel Handford. All rights reserved.
//

#import "KBUserInfoLabels.h"

#import "KBProofLabel.h"

#import <NAChloride/NAChloride.h>
#import <KBKeybase/KBKeybase.h>


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
    //CGFloat x = (size.width/2.0) - 25;
    CGFloat x = 100;
    CGFloat y = 0;
    CGFloat lineHeight = 18;

    if ([yself.headerLabel hasText]) {
      CGSize headerLabelSize = [yself.headerLabel sizeThatFits:size];
      [layout setFrame:CGRectMake(x - headerLabelSize.width, 0, headerLabelSize.width, lineHeight) view:yself.headerLabel];
    }

    if (yself.imageView.image) {
      [layout setFrame:CGRectMake(x - 35, y, lineHeight, lineHeight) view:yself.imageView];
    }

    for (NSView *view in yself.labels) {
      y += [layout setFrame:CGRectMake(x, y, size.width - x - 40, lineHeight) view:view options:YOLayoutOptionsSizeToFitHorizontal|YOLayoutOptionsConstrainWidth].size.height;
    }

    return CGSizeMake(size.width, y);
  }];
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
  for (id label in _labels) {
    if ([label respondsToSelector:@selector(proofResult)]) {
      if ([[label proofResult].proof.sigId isEqual:proofResult.proof.sigId]) return label;
      //if (label.proofResult.proof.proofType == proofResult.proof.proofType && [label.proofResult.proof.value isEqual:proofResult.proof.value]) return label;
    }
  }
  return nil;
}

- (void)addKey:(KBRFOKID *)key targetBlock:(void (^)(id sender, id object))targetBlock {
  _imageView.image = [NSImage imageNamed:@"1-Edition-black-key-2-30"];
  [_headerLabel setText:nil font:[NSFont systemFontOfSize:14] color:[KBLookAndFeel textColor] alignment:NSLeftTextAlignment];

  NSString *keyDescription = NSStringFromKBKeyFingerprint(KBPGPKeyIdFromFingerprint([key.pgpFingerprint na_hexString]), 0);
  KBButton *button = [KBButton buttonWithText:keyDescription style:KBButtonStyleLink];
  button.targetBlock = ^{

  };

  [_labels addObject:button];
  [self addSubview:button];
  [self setNeedsLayout];
}

- (void)addCryptocurrency:(KBRCryptocurrency *)cryptocurrency targetBlock:(void (^)(id sender, id object))targetBlock {
  _imageView.image = [NSImage imageNamed:@"24-Business-Finance-black-bitcoins-30"];
  [_headerLabel setText:nil font:[NSFont systemFontOfSize:14] color:[KBLookAndFeel textColor] alignment:NSLeftTextAlignment];
  KBButton *button = [KBButton buttonWithText:cryptocurrency.address style:KBButtonStyleLink];
  button.targetBlock = ^{

  };
  [_labels addObject:button];
  [self addSubview:button];
  [self setNeedsLayout];
}

- (void)addProofResults:(NSArray *)proofResults header:(NSString *)header targetBlock:(void (^)(KBProofLabel *proofLabel))targetBlock {
  _proofResults = proofResults;
  NSImage *image = [NSImage imageNamed:[self imageNameForType:header]];
  _imageView.image = image;

  if (!_imageView.image) {
    [_headerLabel setText:header font:[NSFont systemFontOfSize:14] color:[KBLookAndFeel textColor] alignment:NSLeftTextAlignment];
  } else {
    _headerLabel.attributedText = nil;
  }

  if ([proofResults count] == 0) {
    //[self addLabelWithText:@"Edit" font:[NSFont systemFontOfSize:14] tag:-1 targetBlock:^(id sender) { targetBlock(blockSelf, nil); }];
  } else {
    for (NSInteger index = 0; index < [proofResults count]; index++) {
      KBProofLabel *proofLabel = [KBProofLabel labelWithProofResult:proofResults[index]];
      __weak KBProofLabel *selectLabel = proofLabel;
      proofLabel.targetBlock = ^{ targetBlock(selectLabel); };
      [_labels addObject:proofLabel];
      [self addSubview:proofLabel];
    }
  }

  [self setNeedsLayout];
}

@end
