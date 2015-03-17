//
//  KBScrollView.m
//  Keybase
//
//  Created by Gabriel on 2/12/15.
//  Copyright (c) 2015 Gabriel Handford. All rights reserved.
//

#import "KBScrollView.h"

@interface KBScrollView ()
@end

@implementation KBScrollView

- (void)viewInit {
  [super viewInit];

  _scrollView = [[NSScrollView alloc] init];
  // TODO probably shouldn't have these defaults here, they seem to be more common though
  _scrollView.hasVerticalScroller = YES;
  _scrollView.verticalScrollElasticity = NSScrollElasticityAllowed;
  _scrollView.autohidesScrollers = YES;
  [self addSubview:_scrollView];

  YOSelf yself = self;
  self.viewLayout = [YOLayout layoutWithLayoutBlock:^(id<YOLayout> layout, CGSize size) {
    if ([yself.scrollView.documentView isKindOfClass:YOView.class]) {
      [layout sizeToFitVerticalInFrame:CGRectMake(0, 0, size.width, size.height) view:yself.scrollView.documentView];
    }
    [layout setSize:size view:yself.scrollView options:0];
    return size;
  }];
}

- (void)setDocumentView:(NSView *)documentView {
  [_scrollView setDocumentView:documentView];
  [self setNeedsLayout];
}

@end
