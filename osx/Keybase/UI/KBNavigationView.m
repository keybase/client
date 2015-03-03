//
//  KBNavigationView.m
//  Keybase
//
//  Created by Gabriel on 1/19/15.
//  Copyright (c) 2015 Gabriel Handford. All rights reserved.
//

#import "KBNavigationView.h"

#import <QuartzCore/QuartzCore.h>
#import "KBNavigationTitleView.h"
#import <GHKit/GHKit.h>

@interface KBNavigationView ()
@property NSMutableArray *views;
@property YONSView *contentView;
@end

@interface NSView (KBViews)
- (void)setNavigation:(KBNavigationView *)navigation;
- (void)viewWillAppearInView:(NSView *)view animated:(BOOL)animated;
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
      y += [layout sizeToFitVerticalInFrame:CGRectMake(0, 0, size.width, 0) view:yself.titleView].size.height;
    }

    [layout setFrame:CGRectMake(0, y, size.width, size.height - y) view:yself.contentView];
    for (NSView *view in yself.views) {
      [layout setFrame:CGRectMake(0, 0, size.width, size.height - y) view:view];
    }
    return size;
  }];
}

- (instancetype)initWithView:(NSView *)view title:(NSString *)title {
  if ((self = [super initWithFrame:CGRectZero])) {
    self.titleView = [KBNavigationTitleView titleViewWithTitle:title navigation:self];
    [self setView:view transitionType:KBNavigationTransitionTypeNone];
  }
  return self;
}

- (BOOL)mouseDownCanMoveWindow {
  return YES;
}

- (void)pushView:(NSView *)view animated:(BOOL)animated {
  [self _setView:view transitionType:(animated ? KBNavigationTransitionTypePush : KBNavigationTransitionTypeNone)];
  [self addView:view];
}

- (void)swapView:(NSView *)view animated:(BOOL)animated {
  NSView *currentView = [self currentView];
  [self _setView:view transitionType:(animated ? KBNavigationTransitionTypeFade : KBNavigationTransitionTypeNone)];
  if (currentView) [self removeView:currentView];
  [self addView:view];
}

- (void)setView:(NSView *)view transitionType:(KBNavigationTransitionType)transitionType {
  [self _setView:view transitionType:KBNavigationTransitionTypeFade];
  NSArray *views = [_views copy];
  for (NSView *view in views) [self removeView:view];
  [self addView:view];
  [self setNeedsLayout];
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

- (void)viewWillAppearInView:(NSView *)view animated:(BOOL)animated {
  //[[self currentView] viewWillAppearInView:view animated:animated];
}

- (void)viewDidAppear:(BOOL)animated {
  [[self currentView] viewDidAppear:animated];
}

- (void)setTitleView:(NSView<KBNavigationTitleView> *)titleView {
  [_titleView removeFromSuperview];
  _titleView = titleView;
  [self addSubview:_titleView];
  [self setNeedsLayout];
}

- (void)addView:(NSView *)view {
  [_views addObject:view];
  if ([view respondsToSelector:@selector(setNavigation:)]) {
    [view setNavigation:self];
  } else {
    GHDebug(@"View (%@) doesn't have a navigation property", NSStringFromClass(view.class));
  }
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

- (void)_setView:(NSView *)inView transitionType:(KBNavigationTransitionType)transitionType {
  NSView *outView = [self currentView];
  if (outView == inView) return;

  //NSAssert(_contentView.frame.size.width > 0 && _contentView.frame.size.height > 0, @"Content size is 0");
  inView.frame = _contentView.bounds;

  CATransition *transition = [self transitionForType:transitionType];
  if (!outView) transition = nil;

  if (transition) {
    self.contentView.animations = @{@"subviews": transition};
    [CATransaction begin];
    //[CATransaction setAnimationDuration:2.0]; // For debug
    [_titleView navigationView:self willTransitionView:inView transitionType:transitionType];
    if ([inView respondsToSelector:@selector(viewWillAppearInView:animated:)]) [inView viewWillAppearInView:_contentView animated:YES];
    [self layoutView];
    [CATransaction setCompletionBlock:^{ if ([inView respondsToSelector:@selector(viewDidAppear:)]) [inView viewDidAppear:YES]; }];
    [self.contentView.animator replaceSubview:outView with:inView];
    [CATransaction commit];
  } else {
    [self layoutView];
    if ([inView respondsToSelector:@selector(viewWillAppearInView:animated:)]) [inView viewWillAppearInView:_contentView animated:NO];
    if (outView) {
      [_contentView replaceSubview:outView with:inView];
    } else {
      [_contentView addSubview:inView];
    }
    dispatch_async(dispatch_get_main_queue(), ^{
      if ([inView respondsToSelector:@selector(viewDidAppear:)]) [inView viewDidAppear:NO];
    });
  }
}

- (void)setProgressEnabled:(BOOL)progressEnabled {
  [self.class setProgressEnabled:progressEnabled subviews:self.views];
  [self.titleView setProgressEnabled:progressEnabled];
}

+ (void)setProgressEnabled:(BOOL)progressEnabled subviews:(NSArray *)subviews {
  for (NSView *view in subviews) {
    if ([view isKindOfClass:NSControl.class]) {
      ((NSControl *)view).enabled = !progressEnabled;
    } else {
      [self setProgressEnabled:progressEnabled subviews:view.subviews];
    }
  }
}

@end
