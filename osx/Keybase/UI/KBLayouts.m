//
//  KBLayouts.m
//  Keybase
//
//  Created by Gabriel on 2/18/15.
//  Copyright (c) 2015 Gabriel Handford. All rights reserved.
//

#import "KBLayouts.h"

@implementation KBLayouts

+ (YOLayoutBlock)center:(id)view {
  return ^CGSize(id<YOLayout> layout, CGSize size) {
    CGSize sizeThatFits = [view sizeThatFits:size];
    [layout centerWithSize:sizeThatFits frame:CGRectMake(0, 0, size.width, size.height) view:view];
    return size;
  };
}

+ (YOLayoutBlock)borderLayoutWithCenterView:(id)centerView topView:(id)topView bottomView:(id)bottomView margin:(UIEdgeInsets)margin padding:(CGFloat)padding maxSize:(CGSize)maxSize {
  return ^CGSize(id<YOLayout> layout, CGSize size) {

    CGSize sizeWithMargin = CGSizeMake(size.width - margin.left - margin.right, size.height - margin.top - margin.bottom);

    CGSize topSize = [topView sizeThatFits:sizeWithMargin];
    CGSize bottomSize = [bottomView sizeThatFits:sizeWithMargin];

    CGFloat centerHeight = sizeWithMargin.height - topSize.height - bottomSize.height - (padding * 2);

    CGFloat y = margin.top;
    if (topView) {
      y += [layout setFrame:CGRectMake(margin.left, y, topSize.width, topSize.height) view:topView].size.height + padding;
    }

    y += [layout setFrame:CGRectMake(margin.left, y, sizeWithMargin.width, centerHeight) view:centerView].size.height + padding;

    if (bottomView) {
      y += [layout setFrame:CGRectMake(margin.left, y, bottomSize.width, bottomSize.height) view:bottomView].size.height;
    }
    
    return CGSizeMake(MIN(size.width, maxSize.width), MIN(size.height, maxSize.height));
  };
}

+ (YOLayoutBlock)gridLayoutForViews:(NSArray *)views viewSize:(CGSize)viewSize padding:(CGFloat)padding {
  return ^CGSize(id<YOLayout> layout, CGSize size) {
    CGSize itemSize = viewSize;
    if (itemSize.width > size.width) itemSize.width = size.width;

    CGFloat x = 0;
    CGFloat y = 0;
    NSInteger index = 0;
    BOOL wrap = NO;
    for (id view in views) {

      wrap = (x + itemSize.width) > size.width;
      if (wrap) {
        x = 0;
        y += itemSize.height + padding;
      }

      [layout setFrame:CGRectMake(x, y, itemSize.width, itemSize.height) view:view];

      // If we didn't wrap on last item, then wrap
      x += itemSize.width + padding;
      index++;
    }
    y += itemSize.height + padding;
    return CGSizeMake(size.width, y);
  };
}

@end
