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
  previewView.hidden = YES;

  _foldersView.foldersView.selectBlock = ^(KBTableView *tableView, NSIndexPath *indexPath, KBFile *file) {
    previewView.hidden = !file;
    if (file) [previewView setFile:file];
  };
  _foldersView.favoritesView.selectBlock = ^(KBTableView *tableView, NSIndexPath *indexPath, KBFile *file) {
    previewView.hidden = !file;
    if (file) [previewView setFile:file];
  };

  [_splitView setSourceView:_foldersView contentView:previewView];

  self.viewLayout = [YOLayout fill:_splitView];
}

- (void)reload {
  //[_foldersView.favoritesView addObjects:@[[KBFile folderWithName:@"test" dateModified:[NSDate date]]]];
}

@end
