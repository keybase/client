//
//  KBSearchListView.m
//  Keybase
//
//  Created by Gabriel on 4/1/15.
//  Copyright (c) 2015 Gabriel Handford. All rights reserved.
//

#import "KBSearchListView.h"

#import "KBListView.h"
#import "KBSearchResultView.h"
#import "KBSearchResult.h"

@interface KBSearchListView ()
@property KBListView *listView;
@end

@implementation KBSearchListView

- (void)viewInit {
  [super viewInit];

  _listView = [KBListView listViewWithPrototypeClass:KBSearchResultView.class rowHeight:56];
  _listView.cellSetBlock = ^(KBSearchResultView *view, KBSearchResult *searchResult, NSIndexPath *indexPath, NSTableColumn *tableColumn, KBListView *listView, BOOL dequeued) {
    [view setSearchResult:searchResult];
  };
  [self addSubview:_listView];

  KBBox *border1 = [KBBox line];
  [self addSubview:border1];

  YOSelf yself = self;
  self.viewLayout = [YOLayout layoutWithLayoutBlock:^CGSize(id<YOLayout> layout, CGSize size) {
    [layout setFrame:CGRectMake(0, 0, size.width, 1) view:border1];
    [layout setFrame:CGRectMake(0, 1, size.width, size.height - 1) view:yself.listView];
    return size;
  }];
}

@end
