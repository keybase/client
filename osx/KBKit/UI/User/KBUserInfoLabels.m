//
//  KBUserInfoLabels.m
//  Keybase
//
//  Created by Gabriel on 1/9/15.
//  Copyright (c) 2015 Gabriel Handford. All rights reserved.
//

#import "KBUserInfoLabels.h"

#import "KBProofLabel.h"

#import "KBDefines.h"
#import "KBFormatter.h"

@interface KBUserInfoLabels ()
@property KBLabel *headerLabel;
@property NSMutableArray *proofLabels;
@property NSMutableArray *buttons;
@end

@implementation KBUserInfoLabels

- (void)viewInit {
  [super viewInit];
  _headerLabel = [[KBLabel alloc] init];
  [self addSubview:_headerLabel];

  _proofLabels = [NSMutableArray array];
  _buttons = [NSMutableArray array];

  YOSelf yself = self;
  self.viewLayout = [YOLayout layoutWithLayoutBlock:^(id<YOLayout> layout, CGSize size) {
    CGFloat col1 = 120;
    CGFloat x = col1;
    CGFloat y = 0;
    CGFloat lineHeight = 18;

    CGSize headerLabelSize = [yself.headerLabel sizeThatFits:size];
    [layout setFrame:CGRectMake(x - headerLabelSize.width - 5, 0, headerLabelSize.width, lineHeight + 1) view:yself.headerLabel];

    for (NSView *view in yself.buttons) {
      y += [layout sizeToFitInFrame:CGRectMake(col1, y, size.width - x - 5, lineHeight) view:view].size.height;
    }

    return CGSizeMake(size.width, y);
  }];
}

- (void)updateProofResult:(KBProofResult *)proofResult {
  KBProofLabel *label = [self findLabelForSigId:proofResult.proof.sigID];
  label.proofResult = proofResult;
  [self setNeedsLayout];
}

- (KBProofLabel *)findLabelForSigId:(NSString *)sigId {
  for (KBProofLabel *label in _proofLabels) {
    if ([[label proofResult].proof.sigID isEqual:sigId]) return label;
  }
  return nil;
}

- (void)addHeader:(NSAttributedString *)header text:(NSAttributedString *)text targetBlock:(dispatch_block_t)targetBlock {
  [_headerLabel setAttributedText:header];
  KBButton *button = [KBButton buttonWithAttributedTitle:text style:KBButtonStyleLink options:0];
  button.targetBlock = targetBlock;
  [_buttons addObject:button];
  [self addSubview:button];
  [self setNeedsLayout];
}

- (void)addKey:(KBRIdentifyKey *)key targetBlock:(void (^)(id sender, KBRIdentifyKey *key))targetBlock {
  [_headerLabel setAttributedText:[KBFontIcon attributedStringForIcon:@"key" style:KBTextStyleDefault options:0 alignment:NSLeftTextAlignment lineBreakMode:NSLineBreakByClipping sender:self]];
  NSString *keyDescription = KBDescriptionForFingerprint(KBPGPKeyIdFromFingerprint(KBHexString(key.pgpFingerprint, @"")), 0);
  KBButton *button = [KBButton buttonWithText:keyDescription style:KBButtonStyleLink alignment:NSLeftTextAlignment lineBreakMode:NSLineBreakByTruncatingTail];
  button.targetBlock = ^{ targetBlock(self, key); };
  [_buttons addObject:button];
  [self addSubview:button];
  [self setNeedsLayout];
}

- (void)addCryptocurrency:(KBRCryptocurrency *)cryptocurrency targetBlock:(void (^)(id sender, id object))targetBlock {
  [_headerLabel setAttributedText:[KBFontIcon attributedStringForIcon:@"bitcoin" style:KBTextStyleDefault options:0 alignment:NSLeftTextAlignment lineBreakMode:NSLineBreakByClipping sender:self]];
  KBButton *button = [KBButton buttonWithText:cryptocurrency.address style:KBButtonStyleLink alignment:NSLeftTextAlignment lineBreakMode:NSLineBreakByTruncatingTail];
  button.targetBlock = ^{ targetBlock(self, cryptocurrency); };
  [_buttons addObject:button];
  [self addSubview:button];
  [self setNeedsLayout];
}

- (void)addProofResults:(NSArray *)proofResults serviceName:(NSString *)serviceName editable:(BOOL)editable targetBlock:(void (^)(KBProofLabel *proofLabel))targetBlock {
  _proofResults = proofResults;

  [_headerLabel setAttributedText:[KBFontIcon attributedStringForIcon:serviceName text:KBShortNameForServiceName(serviceName) style:KBTextStyleDefault options:0 alignment:NSLeftTextAlignment lineBreakMode:NSLineBreakByClipping sender:self] ];

  if ([proofResults count] == 0) {
    //[self addLabelWithText:@"Edit" font:[NSFont systemFontOfSize:14] tag:-1 targetBlock:^(id sender) { targetBlock(blockSelf, nil); }];
  } else {
    for (NSInteger index = 0; index < [proofResults count]; index++) {
      KBProofLabel *proofLabel = [KBProofLabel labelWithProofResult:proofResults[index] editable:editable];
      KBButtonView *button = [KBButtonView buttonViewWithView:proofLabel targetBlock:^{
        targetBlock(proofLabel);
      }];
      [_proofLabels addObject:proofLabel];
      [_buttons addObject:button];
      [self addSubview:button];
    }
  }

  [self setNeedsLayout];
}

@end
