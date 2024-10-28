
<p align="center"><image src="https://github.com/user-attachments/assets/fbf70dac-9c0c-4f98-9b39-c9411e26fcda"></p>



## This is Ridian, _**R**_ in Obs _**idian**_

Run R code in obsidian (cnd-r/cntrol-r to run a code chunk) and more.


**What this is:**

- A way to run R code in Obsidian
- A way to keep notes on Coding/Statistics with enbedded working example
- A way to use Obsidians amazingsearch and links to link code snippets
- A way to use R code snippets to add plots/widgets to your notes

**What I want to add:**

-  Quarto/Rmarkdown export: a way to export notes with r code to .Rmd or .Qmd compliant files


**What this won't be:**

- An Rstudio replacement
- An RMarkdown/Quarto repalacement


## Ease coding by making R environment transparent:


Displays variables in the current environment for transparent coding:

https://github.com/user-attachments/assets/6e21cee6-f287-4319-9cd9-6c152d8b2320

## Get help when coding:

Displays help pages for R packages:

https://github.com/user-attachments/assets/d2f58b8a-5967-4227-a5f4-d4e263670875

## Unlock R's plotting:

Inline R plots in your notes:

https://github.com/user-attachments/assets/bb80a412-9616-4716-b5bc-37344e3f1996

Inline htmlwidgets trough R:

https://github.com/user-attachments/assets/e65af175-5fa8-4813-bf49-01997574a268


## Warnings, limitations and disclosures

> [!WARNING]
> **EXTREMELY EARLY DEVELOPERS RELEASE, DO NOT USE ON YOUR PRECIOUS VAULT, SET UP A SEPERATE DEV-VAULT, OR COPY OF YOUR VAULT TO PLAY WITH THIS!!!**

> [!NOTE]
>
> Seculity Disclosures:
> 
> **Calls on External Executables:** This plugin Executes code in R, an external intepreter, code execution comes with risk, you should at altimes know whether the code is save, don't execute untrusted code. 
> **File Access:** The plugin accesses temporary directories to store plots and widgets, which are then copied the Obsidian vault under the plots/ and widgets/ folders.


> [!NOTE]
> Known Issues:
> 1. uses absolute paths for htmlwidgets
> 2. Every note spins up an R process, if you do this for many notes you'll overwhlm memory
> 3. Only tested on my personal macbook 



## **📥 Ridian: Manual Installation Guide for Obsidian**

**Welcome!** This guide will walk you through the process of installing the **Ridian** plugin in Obsidian using files downloaded from GitHub. Follow the steps below to enhance your Obsidian experience with powerful R code execution capabilities.

### **🔍 Prerequisites**

Before you begin, ensure you have the following:

1. **Obsidian Installed:**
   - **Download Obsidian:** [Obsidian Official Website](https://obsidian.md/)
   - **Installation Guide:** Follow the on-screen instructions to install Obsidian on your computer.

2. **R Installed on Your System:**
   - **Download R:** [CRAN R Project](https://cran.r-project.org/)
   - **Installation Guide:** Choose your operating system (Windows, macOS, Linux) and follow the installation instructions provided on the CRAN website.

3. **Install PANDOC.**
   - If you have RStudio installed PANDOC s usually installed, if not:

   -   **Windows:** Download and run the Pandoc installer from the [pandoc website](https://pandoc.org/installing.html)
   -   **macOS: **Install Pandoc using Homebrew with the command:
```bash
brew install pandoc
```
   -   **Linux:** Install Pandoc via your distribution’s package manager, for example:
   -   
```
bash
sudo apt-get install pandoc
```

### **📝 Step 1: Download the Ridian Plugin Files**

1. **Visit the Plugin's GitHub Repository:**
   - **URL:** [Ridian GitHub Repository](https://github.com/michelnivard/Ridian)  

2. **Navigate to the Releases Section:**
   - On the repository page, look for the **"Releases"** tab (usually found on the right sidebar or under the repository name).
   - **Click on "Releases"** to view all available versions of the plugin.

3. **Download the Latest Release:**
   - **Find the Latest Version:** Releases are typically listed in descending order, with the latest at the top.
   - **Download ZIP File:**
     - Click on the **"Assets"** dropdown under the latest release.
     - Click on **`Ridian.zip`** to download the plugin files as a ZIP archive.




### **🗂️ Step 2: Extract the Downloaded Files**

1. **Locate the Downloaded ZIP File:**
   - Typically found in your **"Downloads"** folder.

2. **Extract the ZIP Archive:**
   - **Windows:**
     - Right-click on the `Ridian.zip` file.
     - Select **"Extract All..."** and choose a destination folder.
   - **macOS:**
     - Double-click the `Ridian.zip` file.
     - It will automatically extract to a folder with the same name.
   - **Linux:**
     - Use your file manager's extract option or run the following command in the terminal:
       ```bash
       unzip Ridian.zip -d Ridian
       ```


### **📂 Step 3: Locate Obsidian’s Plugins Folder**

1. **Open Obsidian:**
   - Launch the Obsidian application on your computer.

2. **Access Obsidian Settings:**
   - Click on the **gear icon** (⚙️) in the bottom-left corner to open **Settings**.

3. **Navigate to Community Plugins:**
   - In the Settings sidebar, click on **"Community plugins"**.

4. **Open Plugins Folder:**
   - Click on the **"Open plugins folder"** button.


   - This action will open the **`.obsidian/plugins`** directory in your file explorer.


### **📦 Step 4: Install the Ridian Plugin**

1. **Move the Plugin Files:**
   - **Locate the Extracted Plugin Folder:**
     - From Step 2, find the extracted `Ridian` folder.
   - **Copy the Folder:**
     - **Windows/macOS/Linux:**
       - Right-click on the `Ridian` folder and select **"Copy"**.
   - **Paste into Plugins Folder:**
     - Navigate to the **`.obsidian/plugins`** folder opened in Step 3.
     - Right-click inside the plugins folder and select **"Paste"**.
   
2. **Verify Plugin Installation:**
   - Inside the **`.obsidian/plugins`** folder, you should now see the **`Ridian`** folder containing files like `manifest.json`, `main.js`, etc.

---

### **⚙️ Step 5: Enable the Plugin in Obsidian**

1. **Return to Obsidian Settings:**
   - If not already open, click on the **gear icon** (⚙️) in Obsidian to open **Settings**.

2. **Access Community Plugins:**
   - In the Settings sidebar, click on **"Community plugins"**.

3. **Disable Safe Mode:**
   - **Important:** To install third-party plugins, you need to disable **Safe mode**.
   - Toggle **"Safe mode"** to **off**.
   - A warning will appear; confirm by clicking **"Yes"** or **"Disable Safe Mode"**.

4. **Enable the Ridian Plugin:**
   - Scroll through the list of available plugins until you find **"Ridian"**.
   - Toggle the switch next to **"Ridian"** to **on**.


5. **Reload Obsidian (If Prompted):**
   - Some plugins may require Obsidian to reload. If prompted, click **"Reload"** to activate the plugin.

### **🔧 Step 6: Configure the Ridian Plugin**

1. **Access Plugin Settings:**
   - In the Settings sidebar, click on **"Ridian"** under the **"Plugins"** section.

2. **Set the Path to R Executable:**
   - **Name:** **Path to R Executable**
   - **Description:** Specify the full path to your R installation.
   - **Example Paths:**
     - **Windows:** `C:\Program Files\R\R-4.2.0\bin\R.exe`
     - **macOS:** `/usr/local/bin/R`
     - **Linux:** `/usr/bin/R`
   - **How to Find R Path:**
     - **Windows:**
       - Open **File Explorer** and navigate to where R is installed (commonly `C:\Program Files\R\`).
       - Locate `R.exe` inside the `bin` folder.
     - **macOS/Linux:**
       - Open **Terminal** and run:
         ```bash
         which R
         ```
       - This command will display the path to the R executable.

   ![Set R Path](https://i.imgur.com/SetRPath.png)
   
   *(Illustrative Image: Replace with an actual screenshot if available.)*

3. **Set the Path to RStudio Pandoc (If Required):**
   - **Name:** **Path to RStudio Pandoc**
   - **Description:** Specify the full path to your RStudio Pandoc installation.
   - **Example Paths:**
     - **Windows:** `C:\Program Files\RStudio\bin\pandoc`
     - **macOS:** `/Applications/RStudio.app/Contents/MacOS/pandoc`
     - **Linux:** `/usr/lib/rstudio/bin/pandoc`
   - **How to Find Pandoc Path:**
     - **Windows/macOS/Linux:**
       - If you have RStudio installed, Pandoc is usually bundled within its installation directory.
       - Use your file explorer to navigate to the RStudio installation folder and locate the `pandoc` directory.

4. **Save Settings:**
   - After entering the paths, click **"Save"** or ensure changes are automatically saved.


### **🚀 Step 7: Using the Ridian Plugin**

1. **Open a Markdown Note:**
   - In Obsidian, open or create a new markdown (`.md`) note where you want to execute R code.

2. **Insert an R Code Chunk:**
   - Use the following syntax to write R code within your note:
     ```markdown
     ```r
     # Your R code here
     ```
     ```

   - **Example:**
     ```markdown
     ```r
     # Calculate the sum of two numbers
     sum(5, 10)
     ```
     ```

3. **Run the R Code Chunk:**
   - **Command:**
     - Press `Ctrl+R` (Windows/Linux) or `Cmd+R` (macOS) to run code chunks!

4. **View Results:**
   - After running the code, the output will appear below the code chunk.
   - Plots and widgets generated by your R code will be displayed in the **right sidebar** under the **R Environment** and **R Help** views.


### **🙌 Thank You!**

You’ve successfully installed the **Ridian** plugin in Obsidian! Start integrating R code into your notes and leverage the power of data analysis and visualization directly within your Obsidian workspace.

If you encounter any issues or have questions, feel free to reach out through the [GitHub Issues](https://github.com/yourusername/Ridian/issues) page or contact the plugin developer.

Happy coding and note-taking! 📝✨
