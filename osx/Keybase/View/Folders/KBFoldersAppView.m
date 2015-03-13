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
#import "KBFoldersView.h"
#import "KBFolderPreviewView.h"

@interface KBFoldersAppView ()
@property KBSplitView *splitView;
@property KBFoldersView *foldersView;
@end

@implementation KBFoldersAppView

- (void)viewInit {
  [super viewInit];

  _splitView = [[KBSplitView alloc] init];
  _splitView.insets = UIEdgeInsetsMake(0, 0, 0, 0);
  _splitView.dividerPosition = -240;
  [self addSubview:_splitView];

  _foldersView = [[KBFoldersView alloc] init];

  KBFolderPreviewView *previewView = [[KBFolderPreviewView alloc] init];

  _foldersView.foldersView.selectBlock = ^(KBTableView *tableView, NSIndexPath *indexPath, KBFolder *folder) {
    [previewView setFolder:folder];
  };
  _foldersView.favoritesView.selectBlock = ^(KBTableView *tableView, NSIndexPath *indexPath, KBFolder *folder) {
    [previewView setFolder:folder];
  };

  [_splitView setSourceView:_foldersView contentView:previewView];

  self.viewLayout = [YOLayout fill:_splitView];
}

- (void)reload {
#ifdef DEBUG
  NSArray *folders = @[[KBFolder folderWithName:@"patrick" dateModified:[[NSDate date] gh_addDays:-100]],
                       [KBFolder folderWithName:@"max,gabrielh" dateModified:[[NSDate date] gh_addDays:-200]],
                       [KBFolder folderWithName:@"chris,gabrielh" dateModified:[NSDate date]],
                       [KBFolder folderWithName:@"Keybase" dateModified:[NSDate date]],];
  [_foldersView.foldersView setObjects:folders];

  NSArray *favorites = [folders subarrayWithRange:NSMakeRange(1, 2)];
  [_foldersView.favoritesView setObjects:favorites];
#endif
}

@end
