//
//  KBErrorView.m
//  Keybase
//
//  Created by Gabriel on 3/6/15.
//  Copyright (c) 2015 Gabriel Handford. All rights reserved.
//

#import "KBErrorView.h"

@interface KBErrorView ()
@property KBLabel *header;
@property KBLabel *label;
@property KBLabel *descriptionLabel;
@property KBButton *closeButton;
@end

@implementation KBErrorView

- (void)viewInit {
  [super viewInit];
  _header = [KBLabel labelWithText:@"Oops" style:KBLabelStyleHeader alignment:NSCenterTextAlignment lineBreakMode:NSLineBreakByTruncatingTail];
  [self addSubview:_header];

  _label = [KBLabel label];
  [self addSubview:_label];

  _descriptionLabel = [KBLabel label];
  [self addSubview:_descriptionLabel];

  _closeButton = [KBButton buttonWithText:@"Close" style:KBButtonStyleLink];
  [self addSubview:_closeButton];

  YOSelf yself = self;
  self.viewLayout = [YOLayout layoutWithLayoutBlock:^CGSize(id<YOLayout> layout, CGSize size) {
    CGFloat width = MAX(size.width, 400);
    CGFloat y = 20;
    y += [layout sizeToFitVerticalInFrame:CGRectMake(20, y, width - 40, 0) view:yself.header].size.height + 20;
    y += [layout sizeToFitVerticalInFrame:CGRectMake(40, y, width - 80, 0) view:yself.label].size.height + 10;
    if ([yself.descriptionLabel hasText]) {
      y += 10;
      y += [layout sizeToFitVerticalInFrame:CGRectMake(40, y, width - 80, 0) view:yself.descriptionLabel].size.height + 20;
    }
    //y += [layout sizeToFitVerticalInFrame:CGRectMake(20, size.height - 40, size.width - 40, 0) view:yself.closeButton].size.height + 20;
    y += [layout sizeToFitVerticalInFrame:CGRectMake(20, y, width - 40, 0) view:yself.closeButton].size.height + 20;
    return CGSizeMake(width, y);
  }];
}

- (void)setError:(NSError *)error {
  [_label setText:error.localizedDescription style:KBLabelStyleDefault appearance:KBAppearance.currentAppearance alignment:NSCenterTextAlignment lineBreakMode:NSLineBreakByWordWrapping];
  [_descriptionLabel setText:error.localizedRecoverySuggestion style:KBLabelStyleSecondaryText appearance:KBAppearance.currentAppearance alignment:NSCenterTextAlignment lineBreakMode:NSLineBreakByWordWrapping];
  [self setNeedsLayout];
}

@end
