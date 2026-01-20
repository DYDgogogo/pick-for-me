# Vercel 部署步骤指南

## ✅ 我已经完成的工作

1. ✅ 初始化 Git 仓库
2. ✅ 创建 `vercel.json` 配置文件
3. ✅ 优化构建配置（缓存策略）
4. ✅ 提交所有代码到本地 Git
5. ✅ 验证构建成功

---

## 📋 你需要完成的步骤（5 分钟）

### 步骤 1：创建 GitHub 仓库（2 分钟）

1. **打开 GitHub**
   - 访问 https://github.com
   - 登录你的账号（如果没有，先注册）

2. **创建新仓库**
   - 点击右上角 "+" → "New repository"
   - **Repository name**: `pick-for-me`（或你喜欢的名字）
   - **Description**: `帮我选 - 选择困难症克星！`
   - **Visibility**: 选择 `Public`（免费）或 `Private`（私有）
   - ⚠️ **重要**：不要勾选 "Initialize this repository with a README"
   - 点击 "Create repository"

3. **复制仓库地址**
   - 创建后会显示一个页面
   - 复制显示的 Git 地址，类似：
     - HTTPS: `https://github.com/你的用户名/pick-for-me.git`
     - 或 SSH: `git@github.com:你的用户名/pick-for-me.git`

---

### 步骤 2：推送代码到 GitHub（1 分钟）

**在终端执行以下命令**（我已经准备好了，你只需要替换仓库地址）：

```bash
cd d:\Code\Pick-For-Me

# 添加远程仓库（替换成你的仓库地址）
git remote add origin https://github.com/你的用户名/pick-for-me.git

# 推送代码
git branch -M main
git push -u origin main
```

**如果遇到认证问题：**
- 使用 GitHub Personal Access Token（推荐）
- 或使用 GitHub Desktop 客户端

---

### 步骤 3：在 Vercel 部署（2 分钟）

1. **访问 Vercel**
   - 打开 https://vercel.com
   - 点击 "Sign Up" 或 "Log In"
   - 选择 "Continue with GitHub"（使用 GitHub 账号登录）

2. **导入项目**
   - 登录后，点击 "Add New Project"
   - 在 "Import Git Repository" 中，选择你刚创建的 `pick-for-me` 仓库
   - 点击 "Import"

3. **配置项目**（通常自动检测，检查即可）
   - **Framework Preset**: `Vite`（应该自动检测）
   - **Root Directory**: `./`（默认）
   - **Build Command**: `npm run build`（自动）
   - **Output Directory**: `dist`（自动）
   - **Install Command**: `npm install`（自动）
   - ✅ 所有配置应该都是正确的（我已经在 `vercel.json` 中配置好了）

4. **部署**
   - 点击 "Deploy" 按钮
   - 等待 1-2 分钟，Vercel 会自动：
     - 安装依赖
     - 运行构建
     - 部署到 CDN

5. **获得访问链接**
   - 部署完成后，你会看到一个绿色的 "Success" 提示
   - 点击 "Visit" 按钮，或复制显示的链接
   - 链接格式：`https://pick-for-me-xxx.vercel.app`

---

### 步骤 4：验证部署（1 分钟）

访问你的部署链接，测试以下功能：
- [ ] 转盘正常显示
- [ ] 可以添加/编辑选项
- [ ] 可以拖拽排序
- [ ] 转盘可以正常旋转
- [ ] 数据可以保存（刷新页面后还在）

---

## 🎉 完成！

部署成功后，你的应用就可以通过链接访问了！

---

## 🔄 后续更新（自动部署）

**好消息**：以后每次你更新代码，只需要：

```bash
git add .
git commit -m "更新描述"
git push
```

Vercel 会自动检测到更新并重新部署！🎊

---

## ❓ 遇到问题？

### 问题 1：Git 推送失败（认证错误）
**解决**：
- 使用 GitHub Personal Access Token
- 或使用 GitHub Desktop 客户端推送

### 问题 2：Vercel 构建失败
**解决**：
- 检查 Vercel 的构建日志
- 确保本地 `npm run build` 可以成功
- 检查是否有环境变量需要配置

### 问题 3：部署后页面空白
**解决**：
- 检查浏览器控制台错误
- 确认 `vercel.json` 中的 `rewrites` 配置正确
- 检查构建产物是否正确

---

## 📝 部署信息记录

部署完成后，记录以下信息：

- **Vercel 项目 URL**: `https://______.vercel.app`
- **GitHub 仓库**: `https://github.com/______/pick-for-me`
- **部署时间**: `____年__月__日`

---

**需要帮助？** 随时告诉我！
