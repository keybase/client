//
//  KBViews.m
//  Keybase
//
//  Created by Gabriel on 3/12/15.
//  Copyright (c) 2015 Gabriel Handford. All rights reserved.
//

#import "KBViews.h"

#import <ObjectiveSugar/ObjectiveSugar.h>

@interface KBViews ()
@property (nonatomic) NSMutableArray *sviews;
@end

@implementation KBViews

- (void)viewInit {
  [super viewInit];
  YOSelf yself = self;
  self.viewLayout = [YOLayout layoutWithLayoutBlock:^CGSize(id<YOLayout> layout, CGSize size) {
    for (NSView *view in yself.sviews) {
      [layout setSize:size view:view options:0];
    }
    return size;
  }];
}

- (void)setViews:(NSArray *)sviews {
  _sviews = [sviews mutableCopy];
  for (NSView *view in _sviews) {
    NSAssert(view.identifier, @"No identifier on view");
    view.hidden = YES;
    [self addSubview:view];
  }
}

- (NSString *)visibleIdentifier {
  return [[_sviews firstObject] identifier];
}

- (void)showViewWithIdentifier:(NSString *)identifier {
  NSView *viewToShow = [_sviews detect:^BOOL(NSView *v) { return [v.identifier isEqualTo:identifier]; }];
  if (!viewToShow.hidden) return;
  NSInteger index = [_sviews indexOfObjectIdenticalTo:viewToShow];
  [self showViewAtIndex:index];
}

- (void)showViewAtIndex:(NSInteger)index {
  NSView *viewToShow = [_sviews objectAtIndex:index];
  NSView *viewToHide = [_sviews firstObject];
  if (viewToShow != viewToHide) {
    [_sviews removeObjectAtIndex:index];
    [_sviews insertObject:viewToShow atIndex:0];
    viewToHide.hidden = YES;
  }
  viewToShow.hidden = NO;
}

//- (void)hideViewWithIdentifier:(NSString *)identifier {
//  NSView *viewToHide = [_sviews detect:^BOOL(NSView *v) { return [v.identifier isEqualTo:identifier]; }];
//  if (!viewToHide.hidden) {
//    [self showViewAtIndex:1];
//  }
//}

@end
