//
//  KBFoldersAppView.m
//  Keybase
//
//  Created by Gabriel on 3/9/15.
//  Copyright (c) 2015 Gabriel Handford. All rights reserved.
//

#import "KBFoldersAppView.h"

#import "KBFolderView.h"
#import "KBFolder.h"
#import "KBFolderListView.h"

@interface KBFoldersAppView ()
@property KBSplitView *splitView;
@property KBFolderListView *listView;
@end

@implementation KBFoldersAppView

- (void)viewInit {
  [super viewInit];

  _splitView = [[KBSplitView alloc] init];
  _splitView.insets = UIEdgeInsetsMake(24, 0, 0, 0);
  _splitView.dividerPosition = -240;
  [self addSubview:_splitView];

  _listView = [[KBFolderListView alloc] init];

  KBView *contentView = [[KBView alloc] init];

  [_splitView setSourceView:_listView contentView:contentView];

  self.viewLayout = [YOLayout fill:_splitView];
}

- (void)reload {
  NSArray *folders = @[[KBFolder folderWithName:@"patrick" dateModified:[[NSDate date] gh_addDays:-100]],
                       [KBFolder folderWithName:@"max,gabrielh" dateModified:[[NSDate date] gh_addDays:-200]],
                       [KBFolder folderWithName:@"chris,gabrielh" dateModified:[NSDate date]],
                       [KBFolder folderWithName:@"Keybase" dateModified:[NSDate date]],];

  [_listView setObjects:folders];
}

@end
