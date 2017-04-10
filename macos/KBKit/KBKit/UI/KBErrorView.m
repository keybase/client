//
//  KBErrorView.m
//  Keybase
//
//  Created by Gabriel on 3/6/15.
//  Copyright (c) 2015 Gabriel Handford. All rights reserved.
//

#import "KBErrorView.h"

@interface KBErrorView ()
@property KBLabel *label;
@property KBLabel *descriptionLabel;
@property KBButton *closeButton;
@end

@implementation KBErrorView

- (void)viewInit {
  [super viewInit];
  [self kb_setBackgroundColor:KBAppearance.currentAppearance.dangerBackgroundColor];
  
  _label = [KBLabel label];
  [self addSubview:_label];

  _descriptionLabel = [KBLabel label];
  [self addSubview:_descriptionLabel];

  _closeButton = [KBButton buttonWithText:@"Close" style:KBButtonStyleDefault];
  [self addSubview:_closeButton];

  YOSelf yself = self;
  self.viewLayout = [YOLayout layoutWithLayoutBlock:^CGSize(id<YOLayout> layout, CGSize size) {
    CGFloat y = 20;
    y += [layout sizeToFitVerticalInFrame:CGRectMake(20, y, size.width - 40, 0) view:yself.label].size.height + 20;

    if ([yself.descriptionLabel hasText]) {
      y += -10;
      y += [layout sizeToFitVerticalInFrame:CGRectMake(20, y, size.width - 40, 0) view:yself.descriptionLabel].size.height + 20;
    }

    if (!yself.closeButton.hidden) {
      y += [layout centerWithSize:CGSizeMake(120, 0) frame:CGRectMake(0, y, size.width, 0) view:yself.closeButton].size.height + 20;
    }

    return CGSizeMake(size.width, y);
  }];
}

- (void)setError:(NSError *)error completion:(dispatch_block_t)completion {
  [_label setText:error.localizedDescription style:KBTextStyleDefault options:KBTextOptionsDanger alignment:NSCenterTextAlignment lineBreakMode:NSLineBreakByWordWrapping];
  [_descriptionLabel setText:error.localizedRecoverySuggestion style:KBTextStyleSecondaryText options:KBTextOptionsDanger alignment:NSCenterTextAlignment lineBreakMode:NSLineBreakByWordWrapping];

  if (completion) {
    _closeButton.targetBlock = completion;
    _closeButton.hidden = NO;
  } else {
    _closeButton.hidden = YES;
  }

  [self setNeedsLayout];
}

@end
