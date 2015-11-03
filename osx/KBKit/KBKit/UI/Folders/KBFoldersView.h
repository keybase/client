//
//  KBFoldersView.h
//  Keybase
//
//  Created by Gabriel on 3/11/15.
//  Copyright (c) 2015 Gabriel Handford. All rights reserved.
//

#import <Foundation/Foundation.h>

#import "KBFileListView.h"

@interface KBFoldersView : YOView

@property (readonly) KBFileListView *favoritesView;
@property (readonly) KBFileListView *foldersView;
@property (nonatomic) KBRPClient *client;

@end
