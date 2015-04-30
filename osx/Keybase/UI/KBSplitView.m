//
//  KBSplitView.m
//  Keybase
//
//  Created by Gabriel on 2/6/15.
//  Copyright (c) 2015 Gabriel Handford. All rights reserved.
//

#import "KBSplitView.h"

#import "KBBox.h"

@interface KBSplitView ()
@property NSView *leftView;
@property NSView *rightView;
@end

@implementation KBSplitView

- (void)viewInit {
  [super viewInit];

  _dividerPosition = 240;

  KBBox *borderMiddle = [KBBox line];
  [self addSubview:borderMiddle];

  YOSelf yself = self;
  self.viewLayout = [YOLayout layoutWithLayoutBlock:^(id<YOLayout> layout, CGSize size) {
    CGFloat col1 = 0;

    if (yself.dividerPosition < 0) {
      col1 = size.width + yself.dividerPosition;
    } else {
      col1 = yself.dividerPosition;
    }
    if (yself.dividerRatio > 0) {
      col1 = size.width * yself.dividerRatio;
    }

    CGFloat y = yself.insets.top;
    [layout setFrame:CGRectMake(col1 - 1, y, 1, size.height) view:borderMiddle];

    [layout setFrame:CGRectMake(0, y, col1 - 1, size.height - y - yself.insets.bottom) view:yself.leftView];
    [layout setFrame:CGRectMake(col1, y, size.width - col1, size.height - y - yself.insets.bottom) view:yself.rightView];
    return size;
  }];
}

- (void)setLeftView:(NSView *)leftView rightView:(NSView *)rightView {
  _leftView = leftView;
  [self addSubview:_leftView];
  _rightView = rightView;
  [self addSubview:_rightView];
  [self setNeedsLayout];
}

@end
