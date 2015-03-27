//
//  KBFoldersAppView.m
//  Keybase
//
//  Created by Gabriel on 3/9/15.
//  Copyright (c) 2015 Gabriel Handford. All rights reserved.
//

#import "KBFoldersAppView.h"

#import "KBFileLabel.h"
#import "KBFile.h"
#import "KBFoldersView.h"
#import "KBFilePreviewView.h"

@interface KBFoldersAppView ()
@property KBSplitView *splitView;
@property KBFoldersView *foldersView;
@end

@implementation KBFoldersAppView

- (void)viewInit {
  [super viewInit];

  _splitView = [[KBSplitView alloc] init];
  _splitView.dividerPosition = -240;
  [self addSubview:_splitView];

  _foldersView = [[KBFoldersView alloc] init];

  KBFilePreviewView *previewView = [[KBFilePreviewView alloc] init];

  _foldersView.foldersView.selectBlock = ^(KBTableView *tableView, NSIndexPath *indexPath, KBFile *file) {
    [previewView setFile:file];
  };
  _foldersView.favoritesView.selectBlock = ^(KBTableView *tableView, NSIndexPath *indexPath, KBFile *file) {
    [previewView setFile:file];
  };

  [_splitView setSourceView:_foldersView contentView:previewView];

  self.viewLayout = [YOLayout fill:_splitView];
}

- (void)reload {
#ifdef DEBUG
  NSArray *folders = @[[KBFile folderWithName:@"patrick" dateModified:[[NSDate date] gh_addDays:-100]],
                       [KBFile folderWithName:@"max,gabrielh" dateModified:[[NSDate date] gh_addDays:-200]],
                       [KBFile folderWithName:@"chris,gabrielh" dateModified:[NSDate date]],
                       [KBFile folderWithName:@"Keybase" dateModified:[NSDate date]],];
  [_foldersView.foldersView setObjects:folders];

  NSArray *favorites = [folders subarrayWithRange:NSMakeRange(1, 2)];
  [_foldersView.favoritesView setObjects:favorites];
#endif
}

@end
