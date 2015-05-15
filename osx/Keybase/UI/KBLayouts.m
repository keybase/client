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

+ (YOLayoutBlock)borderLayoutWithCenterView:(id)centerView topView:(id)topView bottomView:(id)bottomView insets:(UIEdgeInsets)insets spacing:(CGFloat)spacing maxSize:(CGSize)maxSize {
  return ^CGSize(id<YOLayout> layout, CGSize size) {

    CGSize sizeInset = CGSizeMake(size.width - insets.left - insets.right, size.height - insets.top - insets.bottom);

    CGSize topSize = [topView sizeThatFits:CGSizeMake(sizeInset.width, 0)];
    CGSize bottomSize = [bottomView sizeThatFits:CGSizeMake(sizeInset.width, 0)];

    CGFloat centerHeight = sizeInset.height - topSize.height - bottomSize.height;
    if (topView) centerHeight -= spacing;
    if (bottomView) centerHeight -= spacing;

    CGFloat y = insets.top;
    if (topView) {
      y += [layout setFrame:CGRectMake(insets.left, y, topSize.width, topSize.height) view:topView].size.height + spacing;
    }

    y += [layout setFrame:CGRectMake(insets.left, y, sizeInset.width, centerHeight) view:centerView].size.height + spacing;

    if (bottomView) {
      y += [layout setFrame:CGRectMake(insets.left, y, bottomSize.width, bottomSize.height) view:bottomView].size.height;
    }
    
    return CGSizeMake(MIN(size.width, maxSize.width), MIN(size.height, maxSize.height));
  };
}

+ (YOLayoutBlock)borderLayoutWithCenterView:(id)centerView leftView:(id)leftView rightView:(id)rightView insets:(UIEdgeInsets)insets spacing:(CGFloat)spacing {
  return ^CGSize(id<YOLayout> layout, CGSize size) {

    CGSize sizeInset = CGSizeMake(size.width - insets.left - insets.right, size.height - insets.top - insets.bottom);

    CGSize leftSize = [leftView sizeThatFits:CGSizeMake(sizeInset.width, 0)];
    CGSize rightSize = [rightView sizeThatFits:CGSizeMake(sizeInset.width, 0)];

    CGFloat centerWidth = sizeInset.width - leftSize.width - rightSize.width;
    if (leftView) centerWidth -= spacing;
    if (rightView) centerWidth -= spacing;
    CGFloat contentHeight = MAX(leftSize.height, rightSize.height);
    CGFloat height = contentHeight + insets.top + insets.bottom;

    CGFloat x = insets.left;
    if (leftView) {
      x += [layout setFrame:CGRectMake(x, insets.top, leftSize.width, contentHeight) view:leftView].size.width + spacing;
    }

    x += [layout centerWithSize:CGSizeMake(centerWidth, 0) frame:CGRectMake(x, 0, centerWidth, height) view:centerView].size.width + spacing;

    if (rightView) {
      x += [layout setFrame:CGRectMake(x, insets.top, rightSize.width, contentHeight) view:rightView].size.width;
    }

    return CGSizeMake(size.width, height);
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

+ (YOLayoutBlock)vertical:(NSArray *)subviews {
  return ^CGSize(id<YOLayout> layout, CGSize size) {
    CGFloat y = 0;
    for (id subview in subviews) {
      CGRect frame = [subview frame];
      CGRect inFrame = CGRectMake(0, y, size.width, frame.size.height);
      y += [layout sizeToFitVerticalInFrame:inFrame view:subview].size.height;
    }
    return CGSizeMake(size.width, y);
  };
}

/*
+ (YOLayoutBlock)layout:(id)subview options:(YOLayoutOptions)options verticalAlignment:(YOVerticalAlignment)verticalAlignment horizontalAlignment:(YOHorizontalAlignment)horizontalAlignment {
  return ^CGSize(id<YOLayout> layout, CGSize size) {
    if ((options & YOLayoutOptionsSizeToFitHorizontal) != 0 && (options & YOLayoutOptionsSizeToFitVertical) != 0) {
      [layout setSize:size view:subview options:0];
      return size;
    } else if ((options & YOLayoutOptionsSizeToFitHorizontal) != 0) {
      CGSize sizeThatFits = [subview sizeThatFits:size];
      switch (verticalAlignment) {
        case YOVerticalAlignmentMiddle:
          [layout setFrame:CGRectIntegral(CGRectMake(0, size.height/2.0 - sizeThatFits.height/2.0, sizeThatFits.width, sizeThatFits.height)) view:subview];
          break;
        case YOVerticalAlignmentTop:
          [layout setFrame:CGRectIntegral(CGRectMake(0, 0, sizeThatFits.width, sizeThatFits.height)) view:subview];
          break;
        default:
          NSAssert(NO, @"Unsupported");
      }
      return CGSizeMake(sizeThatFits.width, size.height);
    } else if ((options & YOLayoutOptionsSizeToFitVertical) != 0) {
      CGSize sizeThatFits = [subview sizeThatFits:size];
      [layout setSize:CGSizeMake(size.width, sizeThatFits.height) view:subview options:0];
      return CGSizeMake(size.width, sizeThatFits.height);
    } else {
      CGSize sizeThatFits = [subview sizeThatFits:size];
      [layout setSize:sizeThatFits view:subview options:0];
      return sizeThatFits;
    }
  };
}
 */

@end
