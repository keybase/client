//
//  KBHeaderLabelView.m
//  Keybase
//
//  Created by Gabriel on 3/13/15.
//  Copyright (c) 2015 Gabriel Handford. All rights reserved.
//

#import "KBHeaderLabelView.h"

@interface KBHeaderLabelView ()
@property KBLabel *headerLabel;
@property KBImageView *imageView;
@property NSMutableArray *labels;
@end

@implementation KBHeaderLabelView

- (void)viewInit {
  [super viewInit];
  _headerLabel = [[KBLabel alloc] init];
  _headerLabel.verticalAlignment = KBVerticalAlignmentMiddle;
  [self addSubview:_headerLabel];

  _imageView = [[KBImageView alloc] init];
  [self addSubview:_imageView];

  _labels = [NSMutableArray array];

  YOSelf yself = self;
  self.viewLayout = [YOLayout layoutWithLayoutBlock:^(id<YOLayout> layout, CGSize size) {
    CGFloat col1 = 80;
    CGFloat x = col1;
    CGFloat y = 0;
    CGFloat lineHeight = 18;

    if ([yself.headerLabel hasText]) {
      CGSize headerLabelSize = [yself.headerLabel sizeThatFits:size];
      col1 = MAX(headerLabelSize.width, 80);
      [layout setFrame:CGRectMake(x - headerLabelSize.width - 5, 0, headerLabelSize.width, lineHeight + 1) view:yself.headerLabel];
    }

    if (yself.imageView.image) {
      [layout setFrame:CGRectMake(x - 35, y, lineHeight, lineHeight) view:yself.imageView];
    }

    for (NSView *view in yself.labels) {
      y += [layout setFrame:CGRectMake(col1, y, size.width - x - 5, lineHeight) view:view options:YOLayoutOptionsSizeToFitHorizontal].size.height;
    }

    return CGSizeMake(size.width, y);
  }];
}

- (void)setHeader:(NSString *)header {
  [_headerLabel setText:header font:KBAppearance.currentAppearance.boldTextFont color:[KBAppearance.currentAppearance textColor] alignment:NSLeftTextAlignment];
}

- (void)addText:(NSString *)text targetBlock:(dispatch_block_t)targetBlock {
  if (targetBlock) {
    KBButton *button = [KBButton buttonWithText:text style:KBButtonStyleLink];
    button.targetBlock = targetBlock;
    [_labels addObject:button];
    [self addSubview:button];
  } else {
    KBLabel *label = [KBLabel labelWithText:text style:KBLabelStyleDefault];
    [_labels addObject:label];
    [self addSubview:label];
  }
  [self setNeedsLayout];
}

@end