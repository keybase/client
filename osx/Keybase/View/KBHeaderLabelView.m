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
@property CGFloat headerWidth;
@end

@implementation KBHeaderLabelView

- (void)viewInit {
  [super viewInit];
  _headerLabel = [[KBLabel alloc] init];
  [self addSubview:_headerLabel];

  _labels = [NSMutableArray array];

  _headerWidth = 120;

  YOSelf yself = self;
  self.viewLayout = [YOLayout layoutWithLayoutBlock:^(id<YOLayout> layout, CGSize size) {
    CGFloat col = yself.headerWidth;
    CGFloat x = col;
    CGFloat y = 0;

    CGFloat headerHeight = 0;
    if ([yself.headerLabel hasText]) {
      CGSize headerLabelSize = [yself.headerLabel sizeThatFits:size];
      col = MAX(headerLabelSize.width, col);
      headerHeight = headerLabelSize.height;
      [layout setFrame:CGRectMake(x - headerLabelSize.width - 10, y, headerLabelSize.width, headerLabelSize.height) view:yself.headerLabel];
    }

    for (NSView *view in yself.labels) {
      y += [layout sizeToFitVerticalInFrame:CGRectMake(col, y, size.width - col - 5, 0) view:view].size.height;
    }

    y = MAX(y, headerHeight);

    return CGSizeMake(size.width, y);
  }];
}

+ (instancetype)headerLabelViewWithHeader:(NSString *)header headerOptions:(KBTextOptions)headerOptions headerWidth:(CGFloat)headerWidth text:(NSString *)text style:(KBTextStyle)style options:(KBTextOptions)options lineBreakMode:(NSLineBreakMode)lineBreakMode {
  KBHeaderLabelView *view = [[KBHeaderLabelView alloc] init];
  view.headerWidth = headerWidth;
  [view.headerLabel setText:header style:style options:headerOptions alignment:NSLeftTextAlignment lineBreakMode:NSLineBreakByClipping];
  [view addText:text style:style options:options lineBreakMode:lineBreakMode targetBlock:nil];
  return view;
}

- (void)setHeader:(NSString *)header {
  [_headerLabel setText:header style:KBTextStyleDefault options:KBTextOptionsStrong alignment:NSLeftTextAlignment lineBreakMode:NSLineBreakByWordWrapping];
}

- (void)addText:(NSString *)text style:(KBTextStyle)style options:(KBTextOptions)options lineBreakMode:(NSLineBreakMode)lineBreakMode targetBlock:(dispatch_block_t)targetBlock {
  KBLabel *label = [KBLabel labelWithText:text style:style options:options alignment:NSLeftTextAlignment lineBreakMode:lineBreakMode];
  label.selectable = YES;

  if (targetBlock) {
    NSAssert(NO, @"Not implemented"); // TODO Wrap in KBButtonView if selectable
  } else {
    [_labels addObject:label];
    [self addSubview:label];
  }
  [self setNeedsLayout];
}

@end