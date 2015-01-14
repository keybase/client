//
//  WAYSourceListWindow.h
//  WAYSourceListWindow
//
//  Created by Raffael Hannemann on 15.11.14.
//  Copyright (c) 2014 Raffael Hannemann. All rights reserved.
//  Visit weAreYeah.com or follow @weareYeah for updates.
//
//  Licensed under the BSD License <http://www.opensource.org/licenses/bsd-license>
//  THIS SOFTWARE IS PROVIDED BY THE COPYRIGHT HOLDERS AND CONTRIBUTORS "AS IS" AND ANY
//  EXPRESS OR IMPLIED WARRANTIES, INCLUDING, BUT NOT LIMITED TO, THE IMPLIED WARRANTIES
//  OF MERCHANTABILITY AND FITNESS FOR A PARTICULAR PURPOSE ARE DISCLAIMED. IN NO EVENT
//  SHALL THE COPYRIGHT HOLDER OR CONTRIBUTORS BE LIABLE FOR ANY DIRECT, INDIRECT,
//  INCIDENTAL, SPECIAL, EXEMPLARY, OR CONSEQUENTIAL DAMAGES (INCLUDING, BUT NOT LIMITED
//  TO, PROCUREMENT OF SUBSTITUTE GOODS OR SERVICES; LOSS OF USE, DATA, OR PROFITS; OR
//  BUSINESS INTERRUPTION) HOWEVER CAUSED AND ON ANY THEORY OF LIABILITY, WHETHER IN CONTRACT,
//  STRICT LIABILITY, OR TORT (INCLUDING NEGLIGENCE OR OTHERWISE) ARISING IN ANY WAY OUT OF
//  THE USE OF THIS SOFTWARE, EVEN IF ADVISED OF THE POSSIBILITY OF SUCH DAMAGE.
//

#import <Cocoa/Cocoa.h>

/** The WAYSourceListWindow is a NSWindow subclass, which splits the window space vertically into the master view on the left, and the detail view on the right side as known from apps like Reminders or Notes. The window uses a NSSplitView for the splitting. You should add subviews to instances of this class by setting the masterView and detailView. These views will then be added internally to the masterViewWrapper or detailViewWrapper.
 */

NS_CLASS_AVAILABLE_MAC(10_10)
@interface WAYSourceListWindow : NSWindow

@property (strong) NSSplitView *splitView;

/// The Master View is the view on the left side of the window
@property (nonatomic,strong) IBOutlet NSView *masterView;

/// The Detail View is the view on the right side of the window.
@property (nonatomic,strong) IBOutlet NSView *detailView;

/// The color of the Detail View. Default: white.
@property (nonatomic,copy) IBInspectable NSColor *detailViewBackgroundColor;

/// The minimum width of the Master View. Default: 150.
@property (nonatomic) IBInspectable CGFloat minimumMasterViewWidth;

/// The maximum width of the Master View. Default: 300.
@property (nonatomic) IBInspectable CGFloat maximumMasterViewWidth;

/// The maximum width of the Master View. Default: 200.
@property (nonatomic) IBInspectable CGFloat initialMasterViewWidth;

/// If set to YES, the Master View will use a Vibrant Dark look, instead of a Vibrant White look. Default: NO.
@property (nonatomic) IBInspectable BOOL darkMasterViewMaterial;

@end