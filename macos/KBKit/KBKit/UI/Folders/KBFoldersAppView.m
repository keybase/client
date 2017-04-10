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
#import <MDPSplitView/MDPSplitView.h>
#import <YOLayout/YOLayout+PrefabLayouts.h>

@interface KBFoldersAppView ()
@property MDPSplitView *splitView;
@property KBFoldersView *foldersView;
@end

@implementation KBFoldersAppView

- (void)viewInit {
  [super viewInit];

  _splitView = [[MDPSplitView alloc] init];
  [self addSubview:_splitView];

  _foldersView = [[KBFoldersView alloc] init];

  KBFilePreviewView *previewView = [[KBFilePreviewView alloc] init];
  previewView.hidden = YES;

  _foldersView.foldersView.onSelect = ^(KBTableView *tableView, KBTableSelection *selection) {
    KBFile *file = selection.object;
    previewView.hidden = !file;
    if (file) [previewView setFile:file];
  };
  _foldersView.favoritesView.onSelect = ^(KBTableView *tableView, KBTableSelection *selection) {
    KBFile *file = selection.object;
    previewView.hidden = !file;
    if (file) [previewView setFile:file];
  };

  _splitView.vertical = YES;
  _splitView.dividerStyle = NSSplitViewDividerStyleThin;
  [_splitView addSubview:_foldersView];
  [_splitView addSubview:previewView];
  [_splitView adjustSubviews];
  GHWeakSelf gself = self;
  dispatch_async(dispatch_get_main_queue(), ^{
    [gself.splitView setPosition:self.frame.size.width - 240 ofDividerAtIndex:0 animated:NO];
  });

  self.viewLayout = [YOLayout fill:_splitView];
}

- (void)setClient:(KBRPClient *)client {
  _client = client;
  _foldersView.client = client;
}

- (void)reload {
  //[_foldersView.favoritesView addObjects:@[[KBFile folderWithName:@"test" dateModified:[NSDate date]]]];
}

@end
