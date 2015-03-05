//
//  KBProgressOverlayView.m
//  Keybase
//
//  Created by Gabriel on 1/19/15.
//  Copyright (c) 2015 Gabriel Handford. All rights reserved.
//

#import "KBProgressOverlayView.h"

#import "KBActivityIndicatorView.h"
#import "KBLabel.h"
#import "KBAppearance.h"

@interface KBProgressOverlayView ()
//@property NSView *overlay;
@property KBLabel *label;
@property (nonatomic) KBActivityIndicatorView *indicatorView;
@end

@implementation KBProgressOverlayView

- (void)viewInit {
  [super viewInit];

  self.hidesWhenStopped = YES;
  self.hidden = YES;

  self.wantsLayer = YES;

//  _overlay = [[NSView alloc] init];
//  _overlay.wantsLayer = YES;
//  self.layer.backgroundColor = [NSColor colorWithDeviceRed:1.0 green:0 blue:0 alpha:0.5].CGColor;
//  [self addSubview:_overlay];

  _label = [[KBLabel alloc] init];
  [_label setText:@"Loading ..." font:[NSFont systemFontOfSize:20] color:[KBAppearance.currentAppearance textColor] alignment:NSCenterTextAlignment];
  [self addSubview:_label];

  _indicatorView = [[KBActivityIndicatorView alloc] init];
  [self addSubview:_indicatorView];

  YOSelf yself = self;
  self.viewLayout = [YOLayout layoutWithLayoutBlock:^CGSize(id<YOLayout> layout, CGSize size) {
    CGFloat indicatorWidth = 84;

    if (size.width == 0) size.width = 140;
    if (size.height == 0) size.height = 140;

    CGFloat x = size.width/2.0 - indicatorWidth/2.0;
    CGFloat y = size.height/2.0 - indicatorWidth/2.0;

    y += [layout setFrame:CGRectMake(x, y, indicatorWidth, indicatorWidth) view:yself.indicatorView].size.height;
    [layout sizeToFitVerticalInFrame:CGRectMake(0, 0, size.width, 0) view:yself.label];
    return CGSizeMake(size.width, size.height);
  }];
}

//- (NSView *)hitTest:(NSPoint)point {
//  if (self.hidden) return nil;
//  return self;
//}

- (void)setAnimating:(BOOL)animating {
  animating ? [self startAnimating] : [self stopAnimating];
}

- (BOOL)isAnimating {
  return _indicatorView.animating;
}

- (void)startAnimating {
  if (self.hidesWhenStopped) self.hidden = NO;
  [_indicatorView startAnimating];
}

- (void)stopAnimating {
  if (self.hidesWhenStopped) self.hidden = YES;
  [_indicatorView stopAnimating];
}

@end
