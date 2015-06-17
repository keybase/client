//
//  KBTitleView.m
//  Keybase
//
//  Created by Gabriel on 3/4/15.
//  Copyright (c) 2015 Gabriel Handford. All rights reserved.
//

#import "KBTitleView.h"

#import "KBLabel.h"
#import "KBBox.h"
#import "KBActivityIndicatorView.h"
#import <GHKit/GHKit.h>
#import "NSView+KBView.h"

@interface KBTitleView ()
@property KBLabel *label;
@property KBBox *border;
@property KBActivityIndicatorView *progressView;
@end

@implementation KBTitleView

- (void)viewInit {
  [super viewInit];

  _height = 32;
  [self kb_setBackgroundColor:KBAppearance.currentAppearance.secondaryBackgroundColor];

  _label = [[KBLabel alloc] init];
  [self addSubview:_label];

  _border = [KBBox horizontalLine];
  [self addSubview:_border];

  _progressView = [[KBActivityIndicatorView alloc] init];
  [self addSubview:_progressView];

  YOSelf yself = self;
  self.viewLayout = [YOLayout layoutWithLayoutBlock:^(id<YOLayout> layout, CGSize size) {
    CGFloat y = 0;

    CGSize labelSize = [yself.label sizeThatFits:CGSizeMake(size.width, yself.height)];
    CGRect labelRect = [layout centerWithSize:CGSizeMake(size.width - 10, labelSize.height) frame:CGRectMake(10, y, size.width - 10, yself.height) view:yself.label];
    [layout setFrame:CGRectMake(CGRectGetMaxX(labelRect), y + 7, 18, 18) view:yself.progressView];
    y += yself.height;

    [layout setFrame:CGRectMake(0, y - 1, size.width, 1) view:yself.border];
    return CGSizeMake(size.width, y);
  }];
}

+ (instancetype)titleViewWithTitle:(NSString *)title {
  KBTitleView *titleView = [[self alloc] initWithFrame:CGRectMake(0, 0, 360, 0)];
  [titleView setTitle:title];
  return titleView;
}

- (BOOL)mouseDownCanMoveWindow {
  return YES;
}

- (void)setProgressEnabled:(BOOL)progressEnabled {
  [_progressView setAnimating:progressEnabled];
}

- (BOOL)isProgressEnabled {
  return _progressView.isAnimating;
}

- (void)setTitle:(NSString *)title {
  [_label setText:title style:KBTextStyleDefault alignment:NSCenterTextAlignment lineBreakMode:NSLineBreakByTruncatingTail];
  [self setNeedsLayout];
}

@end
