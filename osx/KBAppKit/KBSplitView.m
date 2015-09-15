//
//  KBSplitView.m
//  Keybase
//
//  Created by Gabriel on 2/6/15.
//  Copyright (c) 2015 Gabriel Handford. All rights reserved.
//

#import "KBSplitView.h"

#import "KBBox.h"

@implementation KBSplitView

- (void)viewInit {
  [super viewInit];

  _dividerPosition = 240;

  _divider = [KBBox line];
  [self addSubview:_divider];

  YOSelf yself = self;
  self.viewLayout = [YOLayout layoutWithLayoutBlock:^(id<YOLayout> layout, CGSize size) {
    CGFloat col = 0;

    if (yself.dividerPosition < 0) {
      col = size.width + yself.dividerPosition;
    } else {
      col = yself.dividerPosition;
    }
    if (yself.dividerRatio > 0) {
      col = ceilf(size.width * yself.dividerRatio);
    }

    CGFloat x = 0;
    CGFloat y = 0;
    if (!yself.divider.hidden) {
      [layout setFrame:CGRectMake(col - 1, y, 1, size.height) view:yself.divider];
    } else {
      col++;
    }

    NSAssert(yself.vertical, @"Only support vertical");
    for (NSView *view in yself.subviews) {
      if (view == yself.divider) continue;
      x += [layout setFrame:CGRectMake(x, y, col - 1, size.height - y) view:view].size.width;
      // Only for last element?
      col = size.width - x;
    }
    return size;
  }];
}

- (void)adjustSubviews {
  [self setNeedsLayout];
}

- (void)setPosition:(CGFloat)position ofDividerAtIndex:(NSInteger)dividerIndex animated:(BOOL)animated {
  NSAssert(dividerIndex == 0, @"Only support 1 divider");
  _dividerPosition = position;
}

@end
