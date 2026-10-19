# 智能 SPC 统计过程控制系统 - 本地部署运行指南

本项目是基于 **React 19 + TypeScript + Tailwind CSS + Express (全栈方案 B)** 打造的工业级 SPC 统计过程控制系统。

---

## 🛠️ 1. 环境准备与要求

在本地电脑运行前，请确认已安装 Node.js 环境：
- **Node.js**: **>= 18.0.0** (推荐使用 **Node 20 LTS** 或更高版本)
  - 检查命令：`node -v`
- **npm**: **>= 9.0.0** (或使用 pnpm / yarn)
  - 检查命令：`npm -v`

> 若未安装 Node.js，请访问 [Node.js 官网 (https://nodejs.org/)](https://nodejs.org/) 下载并安装 LTS 版本。

---

## 🚀 2. 本地运行步骤（必读）

### 第一步：进入项目目录并安装依赖
解压或克隆项目到本地后，在终端（Terminal / CMD / PowerShell）中进入项目文件夹，执行安装命令：

```bash
npm install
```

> **常见问题**：如果不执行 `npm install` 直接运行，会报错找不到 `tsx`、`vite` 或其他依赖包。

---

### 第二步：启动项目（提供两种启动模式）

#### 模式一：全栈模式（推荐，包含 Express 后端 API 与 Vite 实时服务）
```bash
npm run dev
```
启动成功后，终端将输出：
```
[SPC System] Server running on port 3000
```
在浏览器中打开：**`http://localhost:3000`** 即可使用。

---

#### 模式二：纯前端轻量模式（直接使用 Vite 启动）
若您本地环境未安装或不便运行 Node 后端服务，可直接启动纯前端模式（系统自带本地离线 SPC 计算引擎与样例数据）：
```bash
npm run dev:vite
```
或：
```bash
npx vite
```
在浏览器中打开终端打印的地址（通常为 `http://localhost:5173` 或 `http://localhost:3000`）。

---

### 第三步：生产打包与预览（可选）
若需构建部署到生产静态服务器：
```bash
npm run build
npm run preview
```

---

## ❓ 3. 本地常见报错与排查方案

### 问题 1：提示 `'tsx' 不是内部或外部命令，也不是可运行的程序` 或 `command not found: tsx`
- **原因**：本地尚未执行 `npm install` 安装项目依赖，或者依赖安装不完整。
- **解决**：在项目根目录下重新执行：
  ```bash
  npm install
  ```
  或者全局安装一次 tsx：
  ```bash
  npm install -g tsx
  ```

### 问题 2：提示端口被占用 `listen EADDRINUSE: address already in use :::3000`
- **原因**：本地电脑的 3000 端口已被其他程序（如其他开发服务）占用。
- **解决方式 A**：切换为纯前端模式：
  ```bash
  npm run dev:vite
  ```
- **解决方式 B**：指定其他端口启动：
  - Windows CMD:
    ```cmd
    set PORT=3001 && npm run dev
    ```
  - Windows PowerShell:
    ```powershell
    $env:PORT=3001; npm run dev
    ```
  - Mac / Linux:
    ```bash
    PORT=3001 npm run dev
    ```

### 问题 3：Windows PowerShell 提示 `在此系统上禁止运行脚本 (PSSecurityException)`
- **原因**：Windows 系统的 PowerShell 脚本执行策略受限。
- **解决**：在当前 PowerShell 窗口中运行一次解禁命令：
  ```powershell
  Set-ExecutionPolicy -Scope Process -ExecutionPolicy Bypass
  ```
  然后再执行 `npm run dev`。

### 问题 4：Node.js 版本过低（如 Node 14 / 16）
- **现象**：提示 `SyntaxError`、`Cannot use import statement` 或 `@tailwindcss/vite` 不支持。
- **解决**：请升级 Node.js 至 18 或 20 LTS 版本。

---

## 📋 4. 系统核心功能清单
- **全类型 SPC 控制图**：
  - 计量型：$\bar{X}-R$（均值-极差）、$\bar{X}-S$（均值-标准差）、$I-MR$（单值-移动极差）
  - 计数型：$P$ 图（不良率）、$NP$ 图（不合格品数）、$C$ 图（缺陷总数）、$U$ 图（单位缺陷数）
- **Nelson 8 大判异准则**：支持界面自由勾选任意规则，实时判异报警
- **Excel 模板搭建与按批号聚合**：支持自定义模板搭建与下载，Excel 批量拖拽上传，并按**生产批号（Batch No）**聚合子组
- **子组数据管理**：核心列仅保留【序号、采集时间、生产批号、工序、设备号】，支持数据作废/剔除后**自动实时重新计算控制限**
- **过程能力分析**：Cp、Cpk、Pp、Ppk、Ca 与实测数据分布直方图、高斯正态拟合曲线
