//
//  KBTitleView.m
//  Keybase
//
//  Created by Gabriel on 1/28/15.
//  Copyright (c) 2015 Gabriel Handford. All rights reserved.
//

#import "KBTitleView.h"
#import "KBLabel.h"
#import "KBBox.h"
#import "KBActivityIndicatorView.h"

@interface KBTitleView ()
@property KBLabel *label;
@property KBBox *border;
@property BOOL barEnabled;
@property KBActivityIndicatorView *progressView;
@end

@implementation KBTitleView

- (void)viewInit {
  [super viewInit];

  self.wantsLayer = YES;
  self.layer.backgroundColor = [NSColor whiteColor].CGColor;

  NSView *background1 = [[NSView alloc] init];
  background1.wantsLayer = YES;
  background1.layer.backgroundColor = [NSColor colorWithWhite:245.0/255.0 alpha:1.0].CGColor;
  [self addSubview:background1];

  _label = [[KBLabel alloc] init];
  [self addSubview:_label];

  _border = [KBBox lineWithWidth:1.0 color:[NSColor colorWithWhite:225.0/255.0 alpha:1.0]];
  [self addSubview:_border];

  GHWeakSelf gself = self;
  _bar = [[KBNavigationBar alloc] init];
  [_bar setBackTitle:@"Back" targetBlock:^{
    [gself.navigation popViewAnimated:YES];
  }];
  [self addSubview:_bar];
  _bar.alphaValue = 0;
  _barEnabled = NO;

  _progressView = [[KBActivityIndicatorView alloc] init];
  [self addSubview:_progressView];

//  GHWeakSelf gself = self;
//  _backView = [KBButton buttonWithImage:[NSImage imageNamed:@"46-Arrows-black-arrow-65-30"]];
//  _backView.hidden = YES;
//  _backView.targetBlock = ^{
//    [gself.navigation popViewAnimated:YES];
//  };
//  [self addSubview:_backView];

  YOSelf yself = self;
  self.viewLayout = [YOLayout layoutWithLayoutBlock:^(id<YOLayout> layout, CGSize size) {
    //[layout setFrame:CGRectMake(10, 20, yself.backView.image.size.width + 20, size.height - 20) view:yself.backView];

    CGFloat y = 0;

    CGSize labelSize = [yself.label sizeThatFits:size];
    CGRect labelRect = [layout centerWithSize:labelSize frame:CGRectMake(0, y, size.width, 32) view:yself.label];
    [layout setFrame:CGRectMake(CGRectGetMaxX(labelRect), y + 7, 18, 18) view:yself.progressView];
    y += 32;

    [layout setFrame:CGRectMake(0, y - 1, size.width, 1) view:yself.border];

    if (yself.barEnabled) {
      y += [layout setFrame:CGRectMake(0, y, size.width, 32) view:yself.bar].size.height;
    }

    [layout setFrame:CGRectMake(0, 0, size.width, 32) view:background1];
    return CGSizeMake(size.width, y);
  }];
}

+ (instancetype)titleViewWithTitle:(NSString *)title navigation:(KBNavigationView *)navigation {
  KBTitleView *titleView = [[self alloc] initWithFrame:CGRectMake(0, 0, 360, 0)];
  [titleView setTitle:title];
  titleView.navigation = navigation;
  return titleView;
}

- (void)setProgressEnabled:(BOOL)progressEnabled {
  [_progressView setAnimating:progressEnabled];
}

- (void)setTitle:(NSString *)title {
  [_label setText:title font:[NSFont systemFontOfSize:18] color:[NSColor colorWithWhite:0.2 alpha:1.0] alignment:NSCenterTextAlignment];
  [self setNeedsLayout];
}

- (void)navigationView:(KBNavigationView *)navigationView willTransitionView:(NSView *)view transitionType:(KBNavigationTransitionType)transitionType {
  if (transitionType == KBNavigationTransitionTypePush && navigationView.views.count >= 1) {
    _bar.animator.alphaValue = 1.0;
    _barEnabled = YES;
  } else if (transitionType == KBNavigationTransitionTypePop && navigationView.views.count > 2) {
    _bar.animator.alphaValue = 1.0;
    _barEnabled = YES;
  } else {
    _bar.animator.alphaValue = 0.0;
    _barEnabled = NO;
  }
}

@end
