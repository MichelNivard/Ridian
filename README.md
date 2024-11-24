



## This is Ridian, _**R**_ in Obs _**idian**_

literal programming with R notebooks, and Quarto rendering from within Obsidian:

![image](https://github.com/user-attachments/assets/bf0c2809-e231-40d9-a047-e28c9d7a12c2)

**Check out he website:**

Up to date info and install guide:
[https://michelnivard.github.io/Ridian/]

**What this is:**

- A way to run R code in Obsidian
- Full Quarto compliant code chunk processing (allows for seamless transition to other editors)
- Parse a note and make it Quarto compliant, then render with Quarto
  
- A way to keep notes on Coding/Statistics with enbedded working example
- A way to use Obsidians amazingsearch and links to link code snippets
- A way to use R code snippets to add plots/widgets to your notes

**What this won't be:**

- An Rstudio replacement
- an positro replacement

- It wont cover other programming languages (5% chance of python), here is an excelent option for that: [execute code plugin](https://github.com/twibiral/obsidian-execute-code)

> [!IMPORTANT]
> In the Ridian settings provide the path to your R/pandoc/quarto executables, The R executable can for example be at Mac: /usr/local/bin/R Windows: C:\Program Files (x86)\R\R-4.4.1\bin\R.exe
> 
> The plugin will try to guess the R install (and probably fail)


## Demo video:


https://github.com/user-attachments/assets/07f4a935-b53a-429a-96e4-d6f21f3a483a


## Demo render with Quarto



https://github.com/user-attachments/assets/334f7af5-0e71-4b9f-9ac8-672a734c91d8


## Disclosures and Issues:



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


R package Dependecies: In R/Rstudio Install: `languageserver`, `evaluate`, `jsonlite` & `htmlwidgets` packages.

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

In R/Rstudio Install:

```r
install.packages(evaluate)
install.packages(jsonlite)
install.packages(htmlwidgets)
```

In the **Ridian** settings provide the path to your R installation, which can for example be:
   Mac: /usr/local/bin/R
   Windows: C:\Program Files (x86)\R\R-4.4.1\bin\R.exe

After you set the path Ridian will adjust it for internal use (it might look different if you revisit the plugin.

Install pandoc (https://pandoc.org) and point **Ridian** to your pandoc install if you want to use **htmlwidgets** in R.

---

And that’s it! You now have **Ridian** installed and ready to use in Obsidian via BRAT.
