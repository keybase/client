//
//  WAYWindow.m
//  WAYWindow
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

/** This NSWindow subclass provides an interface to enable OS X 10.10 Yosemite exclusive features conveniently. Next to customizing the look of the WAYWindow content view, you can also customize the title bar and standard window buttons (`traffic lights´). The public interface is generally similar to INAppStoreWindow to simplify the migration.
 Whenever it makes sense, the properties of your WAYWindow instance in Interface Builder are inspectable.

 Tips:
 - Check out the WWDC '14 session `Adopting Advanced Features of the New UI of OS X Yosemite´, which provides more details on how to make use of the new Yosemite APIs.
 - Also check out the new APIs in NSScrollView to make use of contentInsets, scrollInsets, and more.
 */
@interface WAYWindow : NSWindow

/// Returns YES, if the class supports vibrant appearances. Can be used to determine if running on OS X 10.10+
+ (BOOL) supportsVibrantAppearances;

/// Defines the window's titlebar height. Defaut: OS X default value.
@property (nonatomic) IBInspectable CGFloat titleBarHeight;

//// Returns the titlebar view of the window, which you can add arbitrary subviews to.
@property (strong,readonly) NSView *titleBarView;

/// If set to YES, the standard window button will be vertically centered. Default: YES.
@property (nonatomic) IBInspectable BOOL centerTrafficLightButtons;

/// Defines the left margin of the standard window buttons. Defaut: OS X default value.
@property (nonatomic) IBInspectable CGFloat trafficLightButtonsLeftMargin;

/// If set to YES, the title of the window will be hidden. Default: YES.
@property (nonatomic) IBInspectable BOOL hidesTitle;

/// Replaces the window's content view with an instance of NSVisualEffectView and applies the Vibrant Dark look. Transfers all subviews to the new content view.
- (void) setContentViewAppearanceVibrantDark;

/// Replaces the window's content view with an instance of NSVisualEffectView and applies the Vibrant Light look. Transfers all subviews to the new content view.
- (void) setContentViewAppearanceVibrantLight;

/// Convenient method to set the NSAppearance of the window to NSAppearanceNameVibrantDark
- (void) setVibrantDarkAppearance;

/// Convenient method to set the NSAppearance of the window to NSAppearanceNameVibrantLight
- (void) setVibrantLightAppearance;

/// Convenient method to set the NSAppearance of the window to NSAppearanceNameVibrantAqua
- (void) setAquaAppearance;

/// Replaces a view of the window subview hierarchy with the specified view, and transfers all current subviews to the new one. The frame of the new view will be set to the frame of the old view, if flag is YES.
- (void) replaceSubview: (NSView *) aView withView: (NSView *) newView resizing: (BOOL) flag;

/// Replaces a view of the window subview hierarchy with a new view of the specified NSView class, and transfers all current subviews to the new one.
- (NSView *) replaceSubview: (NSView *) aView withViewOfClass: (Class) newViewClass;

/// Returns YES if the window is currently in full-screen.
- (BOOL) isFullScreen;

@end