//
//  KBErrorStatusView.m
//  Keybase
//
//  Created by Gabriel on 3/6/15.
//  Copyright (c) 2015 Gabriel Handford. All rights reserved.
//

#import "KBErrorStatusView.h"

@interface KBErrorStatusView ()
@property KBLabel *titleLabel;
@property KBLabel *label;
@property KBLabel *descriptionLabel;
@property YOHBox *buttons;
@end

@implementation KBErrorStatusView

- (void)viewInit {
  [super viewInit];
  [self kb_setBackgroundColor:KBAppearance.currentAppearance.backgroundColor];

  YOView *contentView = [YOView view];
  {
    _titleLabel = [KBLabel label];
    [contentView addSubview:_titleLabel];

    _label = [KBLabel label];
    [contentView addSubview:_label];

    _descriptionLabel = [KBLabel label];
    [contentView addSubview:_descriptionLabel];

    _buttons = [YOHBox box:@{@"horizontalAlignment": @"center", @"spacing": @(10)}];
    [contentView addSubview:_buttons];

    YOSelf yself = self;
    contentView.viewLayout = [YOLayout layoutWithLayoutBlock:^CGSize(id<YOLayout> layout, CGSize size) {
      CGFloat y = 20;

      y += [layout sizeToFitVerticalInFrame:CGRectMake(20, y, size.width - 40, 0) view:yself.titleLabel].size.height + 40;

      y += [layout sizeToFitVerticalInFrame:CGRectMake(20, y, size.width - 40, 0) view:yself.label].size.height + 20;

      if ([yself.descriptionLabel hasText]) {
        y += -10;
        y += [layout sizeToFitVerticalInFrame:CGRectMake(20, y, size.width - 40, 0) view:yself.descriptionLabel].size.height + 20;
      }

      if ([yself.buttons.subviews count] > 0) {
        y += 20;
        y += [layout sizeToFitVerticalInFrame:CGRectMake(0, y, size.width, 0) view:yself.buttons].size.height;
      }

      y += 20;
      return CGSizeMake(size.width, y);
    }];
  }
  [self addSubview:contentView];
  self.viewLayout = [YOLayout center:contentView];
}

- (void)viewDidAppear:(BOOL)animated { }

- (void)setError:(NSError *)error title:(NSString *)title retry:(dispatch_block_t)retry close:(dispatch_block_t)close {
  [_titleLabel setText:title style:KBTextStyleHeaderLarge options:0 alignment:NSCenterTextAlignment lineBreakMode:NSLineBreakByWordWrapping];
  [_label setText:error.localizedDescription style:KBTextStyleDefault options:0 alignment:NSCenterTextAlignment lineBreakMode:NSLineBreakByWordWrapping];

  [_descriptionLabel setText:error.localizedRecoverySuggestion style:KBTextStyleDefault options:0 alignment:NSCenterTextAlignment lineBreakMode:NSLineBreakByWordWrapping];

  [_buttons kb_removeAllSubviews];

  if (retry) {
    KBButton *retryButton = [KBButton buttonWithText:@"Retry" style:KBButtonStylePrimary];
    retryButton.targetBlock = retry;
    [_buttons addSubview:retryButton];
  }

  if (close) {
    KBButton *closeButton = [KBButton buttonWithText:@"Quit" style:KBButtonStyleDefault];
    closeButton.targetBlock = close;
    [_buttons addSubview:closeButton];
  }

  [self setNeedsLayout];
}

@end
