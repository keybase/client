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
@property NSView *sourceView;
@property NSView *contentView;
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

    CGFloat y = yself.insets.top + 1;
    [layout setFrame:CGRectMake(col1 - 1, y, 1, size.height) view:borderMiddle];

    [layout setFrame:CGRectMake(0, y, col1 - 1, size.height - y - yself.insets.bottom) view:yself.sourceView];
    [layout setFrame:CGRectMake(col1, y, size.width - col1, size.height - y - yself.insets.bottom) view:yself.contentView];
    return size;
  }];
}

- (void)setSourceView:(NSView *)sourceView contentView:(NSView *)contentView {
  _sourceView = sourceView;
  [self addSubview:sourceView];
  _contentView = contentView;
  [self addSubview:contentView];
  [self setNeedsLayout];
}

@end
