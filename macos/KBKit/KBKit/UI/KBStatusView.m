//
//  KBStatusView.m
//  Keybase
//
//  Created by Gabriel on 3/6/15.
//  Copyright (c) 2015 Gabriel Handford. All rights reserved.
//

#import "KBStatusView.h"

#import <YOLayout/YOLayout+PrefabLayouts.h>

@interface KBStatusView ()
@property KBLabel *titleLabel;
@property KBLabel *label;
@property KBLabel *descriptionLabel;
@property YOHBox *buttons;
@end

@implementation KBStatusView

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
      CGFloat y = yself.insets.top;

      y += [layout sizeToFitVerticalInFrame:CGRectMake(yself.insets.left, y, size.width - yself.insets.left - yself.insets.right, 0) view:yself.titleLabel].size.height + 40;

      y += [layout sizeToFitVerticalInFrame:CGRectMake(yself.insets.left, y, size.width - yself.insets.left - yself.insets.right, 0) view:yself.label].size.height + 20;

      if ([yself.descriptionLabel hasText]) {
        y += -10;
        y += [layout sizeToFitVerticalInFrame:CGRectMake(yself.insets.left, y, size.width - yself.insets.left - yself.insets.right, 0) view:yself.descriptionLabel].size.height + 20;
      }

      if ([yself.buttons.subviews count] > 0) {
        y += 20;
        y += [layout sizeToFitVerticalInFrame:CGRectMake(0, y, size.width, 0) view:yself.buttons].size.height;
      }

      y += yself.insets.bottom;
      return CGSizeMake(size.width, y);
    }];
  }
  [self addSubview:contentView];
  self.viewLayout = [YOLayout center:contentView];
}

- (void)viewDidAppear:(BOOL)animated { }

- (void)setError:(NSError *)error title:(NSString *)title retry:(dispatch_block_t)retry close:(dispatch_block_t)close {
  [self setText:error.localizedDescription description:error.localizedRecoverySuggestion title:title retry:retry close:close];
}

- (void)setText:(NSString *)text description:(NSString *)description title:(NSString *)title retry:(dispatch_block_t)retry close:(dispatch_block_t)close {
  [_titleLabel setText:title style:KBTextStyleHeaderLarge options:0 alignment:NSCenterTextAlignment lineBreakMode:NSLineBreakByWordWrapping];
  [_label setText:text style:KBTextStyleDefault options:0 alignment:NSCenterTextAlignment lineBreakMode:NSLineBreakByWordWrapping];

  [_descriptionLabel setText:description style:KBTextStyleDefault options:0 alignment:NSCenterTextAlignment lineBreakMode:NSLineBreakByWordWrapping];

  [_buttons kb_removeAllSubviews];

  if (retry) {
    KBButton *retryButton = [KBButton buttonWithText:@"Retry" style:KBButtonStylePrimary];
    retryButton.targetBlock = retry;
    [_buttons addSubview:retryButton];
  }

  if (close) {
    KBButton *closeButton = [KBButton buttonWithText:@"Close" style:KBButtonStyleDefault];
    closeButton.targetBlock = close;
    [_buttons addSubview:closeButton];
  }

  [self setNeedsLayout];
}

@end
