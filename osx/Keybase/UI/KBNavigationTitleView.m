//
//  KBNavigationTitleView.m
//  Keybase
//
//  Created by Gabriel on 1/28/15.
//  Copyright (c) 2015 Gabriel Handford. All rights reserved.
//

#import "KBNavigationTitleView.h"
#import "KBLabel.h"
#import "KBBox.h"
#import "KBActivityIndicatorView.h"
#import "KBAppearance.h"
#import <GHKit/GHKit.h>

@interface KBNavigationTitleView ()
@property KBLabel *label;
@property KBBox *border;
//@property BOOL menuBarEnabled;
@property KBActivityIndicatorView *progressView;
@end

@implementation KBNavigationTitleView

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

  _border = [KBBox line];
  [self addSubview:_border];

//  GHWeakSelf gself = self;
//  _menuBar = [[KBMenuBar alloc] init];
//  [_menuBar setBackTitle:@"Back" targetBlock:^{
//    [gself.navigation popViewAnimated:YES];
//  }];
//  [self addSubview:_menuBar];
//  _menuBar.alphaValue = 0;
//  _menuBarEnabled = NO;

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

    CGSize labelSize = [yself.label sizeThatFits:CGSizeMake(size.width, 32)];
    CGRect labelRect = [layout centerWithSize:labelSize frame:CGRectMake(0, y, size.width, 32) view:yself.label];
    //GHDebug(@"labelRect: %@, labelSize: %@, size: %@", YONSStringFromCGRect(labelRect), YONSStringFromCGSize(labelSize), YONSStringFromCGSize(size));
    [layout setFrame:CGRectMake(CGRectGetMaxX(labelRect) + 6, y + 7, 18, 18) view:yself.progressView];
    y += 32;

    [layout setFrame:CGRectMake(0, y - 1, size.width, 1) view:yself.border];

//    if (yself.menuBarEnabled) {
//      y += [layout setFrame:CGRectMake(0, y, size.width, 32) view:yself.menuBar].size.height;
//    }

    [layout setFrame:CGRectMake(0, 0, size.width, 32) view:background1];
    return CGSizeMake(size.width, y);
  }];
}

+ (instancetype)titleViewWithTitle:(NSString *)title navigation:(KBNavigationView *)navigation {
  KBNavigationTitleView *titleView = [[self alloc] initWithFrame:CGRectMake(0, 0, 360, 0)];
  [titleView setTitle:title];
  titleView.navigation = navigation;
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
  [_label setText:title font:[NSFont systemFontOfSize:18] color:KBAppearance.currentAppearance.textColor alignment:NSCenterTextAlignment];
  [self setNeedsLayout];
}

- (void)navigationView:(KBNavigationView *)navigationView willTransitionView:(NSView *)view transitionType:(KBNavigationTransitionType)transitionType {
  /*
  if (transitionType == KBNavigationTransitionTypePush && navigationView.views.count >= 1) {
    _menuBar.animator.alphaValue = 1.0;
    _menuBarEnabled = YES;
  } else if (transitionType == KBNavigationTransitionTypePop && navigationView.views.count > 2) {
    _menuBar.animator.alphaValue = 1.0;
    _menuBarEnabled = YES;
  } else {
    _menuBar.animator.alphaValue = 0.0;
    _menuBarEnabled = NO;
  }
   */
}

@end
