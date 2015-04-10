//
//  KBButtonView.m
//  Keybase
//
//  Created by Gabriel on 4/10/15.
//  Copyright (c) 2015 Gabriel Handford. All rights reserved.
//

#import "KBButtonView.h"

#import "KBButton.h"

@interface KBButtonView ()
@property KBButton *button;
@property (nonatomic) YOView *view;
@end

@implementation KBButtonView

- (void)viewInit {
  [super viewInit];

  _button = [KBButton buttonWithText:nil style:KBButtonStyleEmpty];
  [self addSubview:_button];

  YOSelf yself = self;
  self.viewLayout = [YOLayout layoutWithLayoutBlock:^CGSize(id<YOLayout> layout, CGSize size) {
    CGFloat y = [layout sizeToFitInFrame:CGRectMake(0, 0, size.width, size.height) view:yself.view].size.height;
    [layout setFrame:CGRectMake(0, 0, size.width, y) view:yself.button];
    return CGSizeMake(size.width, y);
  }];
}

+ (instancetype)buttonViewWithView:(YOView *)view targetBlock:(dispatch_block_t)targetBlock {
  KBButtonView *buttonView = [[KBButtonView alloc] init];
  buttonView.button.targetBlock = targetBlock;
  [buttonView setView:view];
  return buttonView;
}

- (void)setView:(YOView *)view {
  [_view removeFromSuperview];
  _view = view;
  [self addSubview:_view];
  [self setNeedsLayout];
}

@end
