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
@property KBBox *border;
@property NSView *contentView;
@end

@implementation KBSplitView

- (void)viewInit {
  [super viewInit];

  self.border = [KBBox line];

  YOSelf yself = self;
  self.viewLayout = [YOLayout layoutWithLayoutBlock:^(id<YOLayout> layout, CGSize size) {
    CGFloat col1 = 150;
    [layout setFrame:CGRectMake(0, 0, col1 - 1, size.height) view:yself.sourceView];
    [layout setFrame:CGRectMake(col1 - 1, 0, 1, size.height) view:yself.border];
    [layout setFrame:CGRectMake(col1, 0, size.width - col1, size.height) view:yself.contentView];
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
