//
//  KBUserListView.m
//  Keybase
//
//  Created by Gabriel on 4/1/15.
//  Copyright (c) 2015 Gabriel Handford. All rights reserved.
//

#import "KBUserListView.h"

#import "KBListView.h"
#import "KBUserView.h"
#import "KBUserProfileView.h"

@interface KBUserListView ()
@property KBListView *listView;
@end

@implementation KBUserListView

- (void)viewInit {
  [super viewInit];

  _listView = [KBListView listViewWithPrototypeClass:KBUserCell.class rowHeight:56];
  _listView.onSet = ^(KBUserView *view, KBRUserSummary *userSummary, NSIndexPath *indexPath, NSTableColumn *tableColumn, KBListView *listView, BOOL dequeued) {
    [view setUserSummary:userSummary];
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

- (void)setUserSummaries:(NSArray *)userSummaries update:(BOOL)update {
  [_listView setObjects:userSummaries animated:NO];
}

@end
