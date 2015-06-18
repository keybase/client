//
//  KBButtonView.m
//  Keybase
//
//  Created by Gabriel on 4/10/15.
//  Copyright (c) 2015 Gabriel Handford. All rights reserved.
//

#import "KBButtonView.h"

@interface KBButtonView ()
@property KBButton *button;
@property (nonatomic) YOView *view;
@end

@implementation KBButtonView

- (void)viewInit {
  [super viewInit];

  _button = [KBButton button];
  [self addSubview:_button];

  YOSelf yself = self;
  self.viewLayout = [YOLayout layoutWithLayoutBlock:^CGSize(id<YOLayout> layout, CGSize size) {
    CGSize viewSize = [layout sizeToFitInFrame:CGRectMake(0, 0, size.width, size.height) view:yself.view].size;
    [layout setSize:viewSize view:yself.button options:0];
    return viewSize;
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

- (void)setButtonStyle:(KBButtonStyle)style options:(KBButtonOptions)options {
  [_button setText:nil style:style options:options alignment:NSLeftTextAlignment lineBreakMode:NSLineBreakByCharWrapping];
}

@end
