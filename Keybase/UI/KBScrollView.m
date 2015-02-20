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
  [_scrollView setHasVerticalScroller:YES];
  _scrollView.verticalScrollElasticity = NSScrollElasticityAllowed;
  [_scrollView setAutoresizingMask:NSViewWidthSizable|NSViewHeightSizable];
  [self addSubview:_scrollView];

  YOSelf yself = self;
  self.viewLayout = [YOLayout layoutWithLayoutBlock:^(id<YOLayout> layout, CGSize size) {
    [layout sizeToFitVerticalInFrame:CGRectMake(0, 0, size.width, 0) view:yself.scrollView.documentView];
    [layout setSize:size view:yself.scrollView options:0];
    return size;
  }];
}

- (void)setDocumentView:(NSView *)documentView {
  [_scrollView setDocumentView:documentView];
}

@end
