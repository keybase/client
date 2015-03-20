//
//  KBFoldersView.m
//  Keybase
//
//  Created by Gabriel on 3/11/15.
//  Copyright (c) 2015 Gabriel Handford. All rights reserved.
//

#import "KBFoldersView.h"

#import "KBFolderListView.h"
#import "KBSearchControl.h"
#import "KBViews.h"

@interface KBFoldersView ()
@property KBSegmentedControl *segmentedControl;
@property KBFolderListView *favoritesView;
@property KBFolderListView *foldersView;
@property KBButton *addButton;
@property KBButton *trashButton;
@property KBSearchControl *searchControl;
@end

@implementation KBFoldersView

- (void)viewInit {
  [super viewInit];
  self.backgroundColor = KBAppearance.currentAppearance.secondaryBackgroundColor;

  _segmentedControl = [[KBSegmentedControl alloc] init];
  [_segmentedControl setSegmentCount:2];
  [_segmentedControl setLabel:@"Favorites" forSegment:0];
  [_segmentedControl setLabel:@"All" forSegment:1];
  [_segmentedControl setSelectedSegment:0];
  [_segmentedControl setTarget:self];
  [_segmentedControl setAction:@selector(_segmentedChange:)];
  [_segmentedControl setWidth:70 forSegment:0];
  [_segmentedControl setWidth:70 forSegment:1];
  //[_segmentedControl setSegmentStyle:NSSegmentStyleCapsule];
  [self addSubview:_segmentedControl];

  NSImage *folderAddImage = [NSImage imageNamed:@"19-Interface-black-add-1-24"];
  folderAddImage.size = CGSizeMake(16, 16);
  _addButton = [KBButton buttonWithImage:folderAddImage style:KBButtonStyleToolbar];
  [self addSubview:_addButton];

//  NSImage *trashImage = [NSImage imageNamed:@"1-Edition-black-bin-2-24"];
//  trashImage.size = CGSizeMake(16, 16);
//  _trashButton = [KBButton buttonWithImage:trashImage style:KBButtonStyleToolbar];
//  [self addSubview:_trashButton];

  _searchControl = [[KBSearchControl alloc] init];
  [self addSubview:_searchControl];

  _favoritesView = [[KBFolderListView alloc] init];
  _favoritesView.identifier = @"Favorites";
  [self addSubview:_favoritesView];

  _foldersView = [[KBFolderListView alloc] init];
  _foldersView.identifier = @"Folders";
  _foldersView.hidden = YES;
  [self addSubview:_foldersView];

  YOSelf yself = self;
  self.viewLayout = [YOLayout layoutWithLayoutBlock:^CGSize(id<YOLayout> layout, CGSize size) {
    CGFloat x = 10;
    CGFloat y = 10;
    CGSize segmentedSize = [yself.segmentedControl sizeThatFits:CGSizeMake(size.width, size.height)];
    segmentedSize.width += 2; // Fix for NSSegmentedControl drawing outsize itself
    segmentedSize.height += 2;
    //y += [layout centerWithSize:segmentedSize frame:CGRectMake(0, y, size.width, 0) view:yself.segmentedControl].size.height + 9;
    x += [layout setFrame:CGRectMake(x, y + 2, segmentedSize.width, segmentedSize.height) view:yself.segmentedControl].size.width + 20;

    x += [layout sizeToFitInFrame:CGRectMake(x, y, size.width, 0) view:yself.addButton].size.width + 20;
    //x += [layout setFrame:CGRectMake(x, y, 24, 24) view:yself.trashButton].size.width + 8;

    [layout setFrame:CGRectMake(x, y, size.width - x - 10, 24) view:yself.searchControl];

    y += 33;

    [layout setFrame:CGRectMake(0, y, size.width, size.height - y) view:yself.favoritesView];
    [layout setFrame:CGRectMake(0, y, size.width, size.height - y) view:yself.foldersView];
    return size;
  }];
}

- (void)_segmentedChange:(id)sender {
  NSInteger segment = [sender selectedSegment];
  if (segment == 0) { _favoritesView.hidden = NO; _foldersView.hidden = YES; }
  if (segment == 1) { _favoritesView.hidden = YES; _foldersView.hidden = NO; }
}

@end
