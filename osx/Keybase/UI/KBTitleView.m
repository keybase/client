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

@interface KBTitleView ()
@property KBLabel *label;
@property KBBox *border;
@property KBActivityIndicatorView *progressView;
@end

@implementation KBTitleView

- (void)viewInit {
  [super viewInit];

  self.wantsLayer = YES;
  self.layer.backgroundColor = [NSColor whiteColor].CGColor;

  NSView *background1 = [[NSView alloc] init];
  background1.wantsLayer = YES;
  background1.layer.backgroundColor = [NSColor colorWithWhite:251.0/255.0 alpha:1.0].CGColor;
  [self addSubview:background1];

  _label = [[KBLabel alloc] init];
  [self addSubview:_label];

  _border = [KBBox lineWithWidth:1.0 color:[NSColor colorWithWhite:225.0/255.0 alpha:1.0] type:KBBoxTypeHorizontalLine];
  [self addSubview:_border];

  _progressView = [[KBActivityIndicatorView alloc] init];
  [self addSubview:_progressView];

  YOSelf yself = self;
  self.viewLayout = [YOLayout layoutWithLayoutBlock:^(id<YOLayout> layout, CGSize size) {
    CGFloat y = 0;

    CGSize labelSize = [yself.label sizeThatFits:CGSizeMake(size.width, 32)];
    CGRect labelRect = [layout centerWithSize:labelSize frame:CGRectMake(0, y, size.width, 32) view:yself.label];
    [layout setFrame:CGRectMake(CGRectGetMaxX(labelRect), y + 7, 18, 18) view:yself.progressView];
    y += 32;

    [layout setFrame:CGRectMake(0, y - 1, size.width, 1) view:yself.border];
    [layout setFrame:CGRectMake(0, 0, size.width, 32) view:background1];
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
  _title = title;
  [_label setText:title style:KBTextStyleDefault alignment:NSCenterTextAlignment lineBreakMode:NSLineBreakByTruncatingTail];
  [self setNeedsLayout];
}

@end
