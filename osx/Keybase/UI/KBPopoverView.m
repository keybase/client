//
//  KBPopoverView.m
//  Keybase
//
//  Created by Gabriel on 3/4/15.
//  Copyright (c) 2015 Gabriel Handford. All rights reserved.
//

#import "KBPopoverView.h"

#import "KBTitleView.h"
#import "KBLabel.h"
#import "KBAppearance.h"
#import "KBWindow.h"

@interface KBPopoverView ()
@property KBTitleView *titleView;
@property KBLabel *label;

@property NSWindow *popoverWindow;
@end

@implementation KBPopoverView

- (void)viewInit {
  [super viewInit];

  self.wantsLayer = YES;
  self.layer.backgroundColor = NSColor.whiteColor.CGColor;
  self.layer.borderColor = KBAppearance.currentAppearance.lineColor.CGColor;
  self.layer.borderWidth = 1.0;
  self.layer.cornerRadius = 4.0;

  NSShadow *dropShadow = [[NSShadow alloc] init];
  dropShadow.shadowColor = NSColor.lightGrayColor;
  dropShadow.shadowOffset = CGSizeMake(2, 2);
  dropShadow.shadowBlurRadius = 4;
  self.shadow = dropShadow;

  _titleView = [[KBTitleView alloc] init];
  _titleView.wantsLayer = YES;
  _titleView.layer.cornerRadius = 4.0;
  [self addSubview:_titleView];

  _label = [[KBLabel alloc] init];
  _label.backgroundColor = NSColor.whiteColor;
  [self addSubview:_label];

  YOSelf yself = self;
  self.viewLayout = [YOLayout layoutWithLayoutBlock:^CGSize(id<YOLayout> layout, CGSize size) {
    CGFloat y = 0;
    y += [layout sizeToFitVerticalInFrame:CGRectMake(0, y, size.width, 0) view:yself.titleView].size.height + 10;
    y += [layout sizeToFitVerticalInFrame:CGRectMake(10, y, size.width - 20, 0) view:yself.label].size.height + 10;
    return CGSizeMake(size.width, y);
  }];
}

- (void)setText:(NSString *)text title:(NSString *)title {
  [_titleView setTitle:title];
  [_label setText:text style:KBLabelStyleDefault];
  [self setNeedsLayout];
}

- (void)sizeToFitWithWidth:(CGFloat)width {
  [self setFrameSize:CGSizeMake(width, 0)];
  [self sizeToFit];
}

- (void)show:(id)sender {
  // Align middle
  CGRect frame = [sender frame];
  self.frame = CGRectMake(frame.origin.x + frame.size.width + 10, frame.origin.y + (self.frame.size.height/2.0), self.frame.size.width, self.frame.size.height);
  [sender addSubview:self];
}

// Not working
- (void)showInWindow:(id)sender {
  if (!self.popoverWindow) {
    NSWindow *window = [KBWindow windowWithContentView:self size:self.frame.size retain:NO];
    window.styleMask = NSFullSizeContentViewWindowMask;
    self.popoverWindow = window;
  }
  // Align middle
  CGRect frame = [sender frame];
  [self.popoverWindow setFrame:CGRectMake(frame.origin.x + frame.size.width + 10, frame.origin.y + (self.frame.size.height/2.0), self.frame.size.width, self.frame.size.height) display:NO];
  if (!self.popoverWindow.parentWindow) {
    [[sender window] addChildWindow:self.popoverWindow ordered:NSWindowAbove];
  }
}

- (void)hide:(id)sender {
  //if (self.popoverWindow) [[sender window] removeChildWindow:self.popoverWindow];
  [self removeFromSuperview];
}

@end
