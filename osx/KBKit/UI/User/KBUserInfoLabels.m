//
//  KBUserInfoLabels.m
//  Keybase
//
//  Created by Gabriel on 1/9/15.
//  Copyright (c) 2015 Gabriel Handford. All rights reserved.
//

#import "KBUserInfoLabels.h"

#import "KBProofLabel.h"
#import "KBProveType.h"
#import "KBDefines.h"
#import "KBFormatter.h"

@interface KBUserInfoLabels ()
@property KBLabel *headerLabel;
@property KBImageView *imageView;
@property NSMutableArray *proofLabels;
@property NSMutableArray *buttons;
@end

@implementation KBUserInfoLabels

- (void)viewInit {
  [super viewInit];
  _headerLabel = [[KBLabel alloc] init];
  [self addSubview:_headerLabel];

  _imageView = [[KBImageView alloc] init];
  [self addSubview:_imageView];

  _proofLabels = [NSMutableArray array];
  _buttons = [NSMutableArray array];

  YOSelf yself = self;
  self.viewLayout = [YOLayout layoutWithLayoutBlock:^(id<YOLayout> layout, CGSize size) {
    //CGFloat x = (size.width/2.0) - 25;
    CGFloat col1 = 120;
    CGFloat x = col1;
    CGFloat y = 0;
    CGFloat lineHeight = 18;

    if ([yself.headerLabel hasText]) {
      CGSize headerLabelSize = [yself.headerLabel sizeThatFits:size];
      [layout setFrame:CGRectMake(x - headerLabelSize.width - 5, 0, headerLabelSize.width, lineHeight + 1) view:yself.headerLabel];
    }

    if (yself.imageView.image) {
      [layout setFrame:CGRectMake(x - 35, y, lineHeight, lineHeight) view:yself.imageView];
    }

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

- (void)addHeader:(NSString *)header text:(NSString *)text targetBlock:(dispatch_block_t)targetBlock {
  [_headerLabel setText:header style:KBTextStyleDefault];
  KBButton *button = [KBButton buttonWithText:text style:KBButtonStyleLink alignment:NSLeftTextAlignment lineBreakMode:NSLineBreakByTruncatingTail];
  button.targetBlock = targetBlock;
  [_buttons addObject:button];
  [self addSubview:button];
  [self setNeedsLayout];
}

- (void)addKey:(KBRFOKID *)key targetBlock:(void (^)(id sender, id object))targetBlock {
  _imageView.image = [NSImage imageNamed:@"1-Edition-black-key-2-30"];
  [_headerLabel setText:nil font:[NSFont systemFontOfSize:14] color:[KBAppearance.currentAppearance textColor] alignment:NSLeftTextAlignment];

  NSString *keyDescription;
  if (key.kid) {
    keyDescription = KBDescriptionForKID(key.kid);
  } else if (key.pgpFingerprint) {
    keyDescription = KBDescriptionForFingerprint(KBPGPKeyIdFromFingerprint(KBHexString(key.pgpFingerprint, @"")), 0);
  }
  KBButton *button = [KBButton buttonWithText:keyDescription style:KBButtonStyleLink alignment:NSLeftTextAlignment lineBreakMode:NSLineBreakByTruncatingTail];
  button.targetBlock = ^{ targetBlock(self, key); };
  [_buttons addObject:button];
  [self addSubview:button];
  [self setNeedsLayout];
}

- (void)addCryptocurrency:(KBRCryptocurrency *)cryptocurrency targetBlock:(void (^)(id sender, id object))targetBlock {
  _imageView.image = [NSImage imageNamed:@"24-Business-Finance-black-bitcoins-30"];
  [_headerLabel setText:nil font:[NSFont systemFontOfSize:14] color:[KBAppearance.currentAppearance textColor] alignment:NSLeftTextAlignment];
  KBButton *button = [KBButton buttonWithText:cryptocurrency.address style:KBButtonStyleLink alignment:NSLeftTextAlignment lineBreakMode:NSLineBreakByTruncatingTail];
  button.targetBlock = ^{ targetBlock(self, cryptocurrency); };
  [_buttons addObject:button];
  [self addSubview:button];
  [self setNeedsLayout];
}

- (void)addProofResults:(NSArray *)proofResults serviceName:(NSString *)serviceName editable:(BOOL)editable targetBlock:(void (^)(KBProofLabel *proofLabel))targetBlock {
  _proofResults = proofResults;
  //NSImage *image = [NSImage imageNamed:KBImageNameForProofType(proofType)];
  //_imageView.image = image;

  //if (!_imageView.image) {
  [_headerLabel setText:KBShortNameForServiceName(serviceName) font:KBAppearance.currentAppearance.textFont color:KBAppearance.currentAppearance.textColor alignment:NSLeftTextAlignment];
  //} else {
  //  _headerLabel.attributedText = nil;
  //}

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
