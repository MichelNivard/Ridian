
<p align="center"><image src="https://github.com/user-attachments/assets/fbf70dac-9c0c-4f98-9b39-c9411e26fcda"></p>



## This is Ridian, _**R**_ in Obs _**idian**_

> [!WARNING]
> **BETA release, wouldn't use on your precious main vault innitially**
>
> Code potentially unstable and executes R code outside your vault, only ever execute code you trust!
> 
> check: Known Issues/To-Do below to ensure there arent any dealbreakers.

Run R code in obsidian (cmd-R/cntrol-R to run a code chunk) and more. This is a somewhat ambitious project to **make R a first class citizen of the Obsidian Universe**.

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


## Disclosures and Issues:


> [!WARNING]
> **BETA release, wouldn't use on your precious main vault innitially**
>
> 1. Only confirmed to work on MacOS on my mackbook & on Win 11's (on my macbook)
> 2. No tests and other development necessities implemented
> 3. No Contribution guilines (but help wanted!)
>


> [!NOTE]
>
> Seculity Disclosures:
> 
> **Calls on External Executables:** This plugin Executes code in R, an external intepreter, code execution comes with risk, you should at altimes know whether the code is save, don't execute untrusted code. 
> **File Access:** The plugin accesses temporary directories to store plots and widgets, which are then copied the Obsidian vault under the plots/ and widgets/ folders.


> [!NOTE]
> Known Issues/To-Do:
> 1. uses absolute paths for htmlwidgets
> 2. Every note spins up an R process, if you do this for many notes you'll overwhlm memory
> 3. Only confirmed to work on MacOS on my mackbook & on Win 11's (on my macbook)
> 4. No tests and other development necessities implemented
> 5. No Contribution guilines (but help wanted!)



## **📥 Ridian: Manual Installation Guide for Obsidian**

Here's a step-by-step guide to installing your Obsidian plugin, **Ridian**, using the BRAT (Beta Reviewers Auto-update Tool) plugin. This guide assumes you have Obsidian and BRAT already installed.

---

### Step 1: Install BRAT (if not already installed)

1. Open Obsidian.
2. Go to **Settings** > **Community Plugins**.
3. Click **Browse** and search for "BRAT".
4. Install **BRAT** and enable it by clicking **Enable** after installation.

---

### Step 2: Add Ridian Plugin in BRAT

1. In Obsidian, go to **Settings** > **BRAT**.
2. Under **Beta Plugins List**, click **Add Beta Plugin**.
3. Paste the GitHub repository URL for Ridian:
   
   ```
   https://github.com/MichelNivard/Ridian
   ```

4. Click **Add Plugin**.

---

### Step 3: Install and Enable Ridian

1. After adding Ridian to BRAT, BRAT will automatically download it for you.
2. Go to **Settings** > **Community Plugins** and find **Ridian** in the list of installed plugins.
3. Enable **Ridian** by clicking **Enable**.

---

### Step 4: Verify Installation

1. Once enabled, check the **Settings** menu for any configuration options related to Ridian. 
2. Ensure you see options to configure or activate the plugin in Obsidian’s interface.

---

### Step 5: Set Path to R instalation & pandoc installation

In the **Ridian** settings provide the path to your R installation, which can for example be:
   Mac: /usr/local/bin/R
   Windows: C:\Program Files (x86)\R\R-4.4.1\bin\R.exe

After you set the path Ridian will adjust it for internal use (it might look different if you revisit the plugin.

Install pandoc (https://pandoc.org) and point **Ridian** to your pandoc install if you want to use **htmlwidgets** in R.

---

And that’s it! You now have **Ridian** installed and ready to use in Obsidian via BRAT.
