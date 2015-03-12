//
//  KBViews.m
//  Keybase
//
//  Created by Gabriel on 3/12/15.
//  Copyright (c) 2015 Gabriel Handford. All rights reserved.
//

#import "KBViews.h"

#import <ObjectiveSugar/ObjectiveSugar.h>

#import "KBBox.h"

@interface KBViews ()
@property KBBox *border;
@property (nonatomic) NSMutableArray *sviews;
@end

@implementation KBViews

- (void)viewInit {
  [super viewInit];
  YOSelf yself = self;

  KBBox *border = [KBBox line];
  self.viewLayout = [YOLayout layoutWithLayoutBlock:^CGSize(id<YOLayout> layout, CGSize size) {
    [layout setFrame:CGRectMake(0, 0, size.width, 1) view:border];
    for (NSView *view in yself.sviews) {
      [layout setFrame:CGRectMake(0, 1, size.width, size.height - 1) view:view];
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
