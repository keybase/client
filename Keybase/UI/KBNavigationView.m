//
//  KBNavigationView.m
//  Keybase
//
//  Created by Gabriel on 1/19/15.
//  Copyright (c) 2015 Gabriel Handford. All rights reserved.
//

#import "KBNavigationView.h"

#import <QuartzCore/QuartzCore.h>

@interface KBNavigationView ()
@property NSMutableArray *views;
@property YONSView *contentView;
@end

@interface NSView (KBViews)
- (void)setNavigation:(KBNavigationView *)navigation;
- (void)viewWillAppear:(BOOL)animated;
- (void)viewDidAppear:(BOOL)animated;
@end

@implementation KBNavigationView

- (void)viewInit {
  [super viewInit];
  _views = [NSMutableArray array];

  _contentView = [[YONSView alloc] init];
  [self addSubview:_contentView];

  YOSelf yself = self;
  self.viewLayout = [YOLayout layoutWithLayoutBlock:^(id<YOLayout> layout, CGSize size) {
    CGFloat y = 0;
    if (yself.titleView) {
      y += [layout setFrame:CGRectMake(0, 0, size.width, yself.titleView.frame.size.height) view:yself.titleView].size.height;
    }

    [layout setFrame:CGRectMake(0, y, size.width, size.height - y) view:yself.contentView];
    for (NSView *view in yself.views) {
      [layout setFrame:CGRectMake(0, 0, size.width, size.height - y) view:view];
    }
    return size;
  }];
}

- (void)pushView:(NSView *)view animated:(BOOL)animated {
  [self _setView:view transitionType:(animated ? KBNavigationTransitionTypePush : KBNavigationTransitionTypeNone)];
  [self addView:view];
}

- (void)swapView:(NSView *)view animated:(BOOL)animated {
  NSView *currentView = [self currentView];
  [self _setView:view transitionType:(animated ? KBNavigationTransitionTypeFade : KBNavigationTransitionTypeNone)];
  if (currentView) [self removeView:currentView];
}

- (void)setView:(NSView *)view transitionType:(KBNavigationTransitionType)transitionType {
  [self _setView:view transitionType:KBNavigationTransitionTypeFade];
  NSArray *views = [_views copy];
  for (NSView *view in views) [self removeView:view];
  [self addView:view];
}

- (void)popViewAnimated:(BOOL)animated {
  if (!_views || _views.count <= 1) {
    [NSException raise:NSGenericException format:@"Navigation must have a view to pop"];
    return;
  }

  NSView *previousView = [self previousView];
  NSView *currentView = [self currentView];

  [self _setView:previousView transitionType:KBNavigationTransitionTypePop];
  [self removeView:currentView];
}

- (void)viewWillAppear:(BOOL)animated {
  [[self currentView] viewWillAppear:animated];
}

- (void)viewDidAppear:(BOOL)animated {
  [[self currentView] viewDidAppear:animated];
}

- (void)setTitleView:(NSView<KBNavigationViewDelegate> *)titleView {
  [_titleView removeFromSuperview];
  _titleView = titleView;
  [self addSubview:_titleView];
  [self setNeedsLayout];
}

- (void)addView:(NSView *)view {
  [_views addObject:view];
  [view setNavigation:self];
}

- (void)removeView:(NSView *)view {
  [_views removeObject:view];
  [view setNavigation:nil];
}

- (NSView *)currentView {
  if (_views.count == 0) return nil;
  return _views[_views.count-1];
}

- (NSView *)previousView {
  if (_views.count <= 1) return nil;
  return _views[_views.count-2];
}

- (void)_setView:(NSView *)view transitionType:(KBNavigationTransitionType)transitionType {
  NSView *currentView = [self currentView];
  if (currentView == view) return;

  [_titleView navigationView:self willTransitionView:view transitionType:transitionType];
  [self replaceView:currentView withView:view transition:[self transitionForType:transitionType]];
}

- (CATransition *)transitionForType:(KBNavigationTransitionType)type {
  switch (type) {
    case KBNavigationTransitionTypeFade: {
      CATransition *transition = [CATransition animation];
      transition.type = kCATransitionFade;
      return transition;
    }
    case KBNavigationTransitionTypePop: {
      CATransition *transition = [CATransition animation];
      transition.type = kCATransitionPush;
      transition.subtype = kCATransitionFromLeft;
      return transition;
    }
    case KBNavigationTransitionTypePush: {
      CATransition *transition = [CATransition animation];
      transition.type = kCATransitionPush;
      transition.subtype = kCATransitionFromRight;
      return transition;
    }
    case KBNavigationTransitionTypeNone:
      return nil;
  }
}

- (void)replaceView:(NSView *)outView withView:(NSView *)inView transition:(CATransition *)transition {
  inView.frame = _contentView.bounds;

  if (!outView) transition = nil;
  [inView viewWillAppear:!!transition];

  if (transition) {
    self.contentView.animations = @{@"subviews": transition};
    [CATransaction begin];
    [CATransaction setCompletionBlock:^{ [inView viewDidAppear:YES]; }];
    [self.contentView.animator replaceSubview:outView with:inView];
    [CATransaction commit];
  } else {
    if (outView) {
      [self replaceSubview:outView with:inView];
    } else {
      [_contentView addSubview:inView];
    }
    [inView viewDidAppear:NO];
  }
}

@end
