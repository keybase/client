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
@property NSMutableArray *labels;
@end

@implementation KBHeaderLabelView

- (void)viewInit {
  [super viewInit];
  _headerLabel = [[KBLabel alloc] init];
  _headerLabel.verticalAlignment = KBVerticalAlignmentMiddle;
  [self addSubview:_headerLabel];

  _labels = [NSMutableArray array];

  YOSelf yself = self;
  self.viewLayout = [YOLayout layoutWithLayoutBlock:^(id<YOLayout> layout, CGSize size) {
    CGFloat col = 120;
    CGFloat x = col;
    CGFloat y = 0;

    CGFloat headerHeight = y;
    if ([yself.headerLabel hasText]) {
      CGSize headerLabelSize = [yself.headerLabel sizeThatFits:size];
      col = MAX(headerLabelSize.width, col);
      headerHeight = [layout sizeToFitHorizontalInFrame:CGRectMake(x - headerLabelSize.width - 5, 0, headerLabelSize.width, headerLabelSize.height) view:yself.headerLabel].size.height;
    }

    for (NSView *view in yself.labels) {
      y += [layout sizeToFitHorizontalInFrame:CGRectMake(col, y, size.width - col - 5, headerHeight) view:view].size.height;
    }

    return CGSizeMake(size.width, y);
  }];
}

- (void)setHeader:(NSString *)header {
  [_headerLabel setText:header style:KBTextStyleStrong];
}

- (void)addText:(NSString *)text style:(KBTextStyle)style targetBlock:(dispatch_block_t)targetBlock {
  KBLabel *label = [KBLabel labelWithText:text style:style alignment:NSLeftTextAlignment lineBreakMode:NSLineBreakByTruncatingMiddle];
  label.verticalAlignment = KBVerticalAlignmentMiddle;

  if (targetBlock) {
    NSAssert(NO, @"Not implemented"); // TODO Wrap in KBButtonView if selectable
  } else {
    [_labels addObject:label];
    [self addSubview:label];
  }
  [self setNeedsLayout];
}

@end