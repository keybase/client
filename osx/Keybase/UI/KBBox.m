//
//  KBBox.m
//  Keybase
//
//  Created by Gabriel on 1/28/15.
//  Copyright (c) 2015 Gabriel Handford. All rights reserved.
//

#import "KBBox.h"
#import "KBAppearance.h"

@interface KBBox ()
@property NSBox *box;
@end

@implementation KBBox

- (void)viewInit {
  [super viewInit];
  self.box = [[NSBox alloc] init];
  [self addSubview:self.box];

  YOSelf yself = self;
  self.viewLayout = [YOLayout layoutWithLayoutBlock:^CGSize(id<YOLayout> layout, CGSize size) {
    [layout setFrame:CGRectMake(yself.insets.left, yself.insets.top, size.width - yself.insets.right - yself.insets.left, size.height - yself.insets.top - yself.insets.bottom) view:yself.box];
    return size;
  }];
}

- (CGSize)sizeThatFits:(CGSize)size {
  return CGSizeMake(size.width, self.box.borderWidth + self.insets.top + self.insets.bottom);
}

+ (KBBox *)line {
  return [self lineWithWidth:1.0 color:KBAppearance.currentAppearance.lineColor];
}

+ (KBBox *)lineWithWidth:(CGFloat)width color:(NSColor *)color {
  KBBox *box = [[KBBox alloc] init];
  box.box.borderColor = color;
  box.box.borderWidth = width;
  box.box.borderType = NSLineBorder;
  box.box.boxType = NSBoxCustom;
  return box;
}

+ (KBBox *)roundedWithWidth:(CGFloat)width color:(NSColor *)color cornerRadius:(CGFloat)cornerRadius {
  KBBox *box = [[KBBox alloc] init];
  box.box.wantsLayer = YES;
  box.box.layer.backgroundColor = NSColor.clearColor.CGColor;
  box.box.borderColor = color;
  box.box.borderWidth = width;
  box.box.borderType = NSLineBorder;
  box.box.boxType = NSBoxCustom;
  return box;
}

+ (KBBox *)lineWithInsets:(UIEdgeInsets)insets {
  KBBox *box = [KBBox line];
  box.insets = insets;
  return box;
}

@end
