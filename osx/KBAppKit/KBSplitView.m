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

  _insets = UIEdgeInsetsZero;
  _rightInsets = UIEdgeInsetsZero;
  
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

    CGFloat y = yself.insets.top;
    if (!yself.divider.hidden) {
      [layout setFrame:CGRectMake(col - 1, y, 1, size.height) view:yself.divider];
    } else {
      col++;
    }

    [layout setFrame:CGRectMake(0, y, col - 1, size.height - y - yself.insets.bottom) view:yself.leftView];
    [layout setFrame:YOCGRectApplyInsets(CGRectMake(col, y, size.width - col, size.height - y - yself.insets.bottom), yself.rightInsets) view:yself.rightView];
    return size;
  }];
}

- (void)setLeftView:(NSView *)leftView {
  if (_leftView != leftView) {
    [_leftView removeFromSuperview];
    _leftView = leftView;
    [self addSubview:_leftView];
  }
  [self setNeedsLayout];
}

- (void)setRightView:(NSView *)rightView {
  if (_rightView != rightView) {
    [_rightView removeFromSuperview];
    _rightView = rightView;
    [self addSubview:_rightView];
  }
  [self setNeedsLayout];
}

@end
