using System;
using System.IO;
using System.Windows;
using System.Windows.Interop;
using System.Web.Script.Serialization;
using System.Runtime.InteropServices;

public class Input
{
    public string title { get; set; }
    public string message { get; set; }
    public string description { get; set; }
    public string outPath { get; set; }
    public bool auto { get; set; }
}

public class Result
{
    public string action { get; set; }
    public bool autoUpdate { get; set; }
    public int snooze_duration { get; set; }
}

namespace WpfApplication1
{
    /// <summary>
    /// Interaction logic for MainWindow.xaml
    /// </summary>
    public partial class MainWindow : Window
    {
        Input input;
        Result result;

        private const int GWL_STYLE = -16;
        private const int WS_SYSMENU = 0x80000;
        [DllImport("user32.dll", SetLastError = true)]
        private static extern int GetWindowLong(IntPtr hWnd, int nIndex);
        [DllImport("user32.dll")]
        private static extern int SetWindowLong(IntPtr hWnd, int nIndex, int dwNewLong);

        private const int snoozeDay = 60 * 60 * 24; // seconds per day

        public MainWindow()
        {
            InitializeComponent();
            result = new Result();
            string[] args = Environment.GetCommandLineArgs();
            if (args != null && args.Length > 1)
            {
                JavaScriptSerializer serializer = new JavaScriptSerializer();
                input = serializer.Deserialize<Input>(args[1]);
            } else
            {
                input = new global::Input();
            }
            if (input.title != null && input.title.Length > 0)
            {
                title.Text = input.title;
            }
            if (input.message != null && input.message.Length > 0)
            {
                message.Text = input.message;
            }
            if (input.description != null && input.description.Length > 0)
            {
                description.Text = input.description;
            }
            if (input.outPath == null || input.outPath.Length <= 0)
            {
                input.outPath = "updaterPromptResult.txt";
            }
            silent.IsChecked = input.auto;
          
        }

        private void apply_Click(object sender, RoutedEventArgs e)
        {
            result.action = "apply";
            result.autoUpdate = (bool) silent.IsChecked;
            writeResult();
        }

        private void writeResult()
        {
            JavaScriptSerializer serializer = new JavaScriptSerializer();
            File.WriteAllText(input.outPath, serializer.Serialize(result));
            Application.Current.Shutdown();
        }

        private void Window_Loaded(object sender, RoutedEventArgs e)
        {
            var hwnd = new WindowInteropHelper(this).Handle;
            SetWindowLong(hwnd, GWL_STYLE, GetWindowLong(hwnd, GWL_STYLE) & ~WS_SYSMENU);
        }

        private void snoozeDuration_DropDownClosed(object sender, EventArgs e)
        {
            var snoozeVal = (System.Windows.Controls.ComboBoxItem) snoozeDuration.SelectedItem;
            if (snoozeVal != null && snoozeDuration.SelectedIndex > 0)
            {
                result.action = "snooze";
                result.snooze_duration = (snoozeVal.Name == "snooze7") ? snoozeDay * 7 : snoozeDay;
                writeResult();
            }
        }
    }
}
