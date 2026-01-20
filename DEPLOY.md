# 部署指南 - 帮我选 (Pick-For-Me)

## 🚀 推荐部署平台：Vercel

**为什么选择 Vercel？**
- ✅ 零配置，自动检测 Vite 项目
- ✅ 全球 CDN，访问速度快
- ✅ 自动 HTTPS
- ✅ 免费额度充足（100GB 带宽/月）
- ✅ 支持 GitHub 自动部署
- ✅ 支持自定义域名

---

## 📦 部署步骤

### 方法 1：通过 Vercel 网站部署（推荐，最简单）

1. **准备代码**
   ```bash
   # 确保代码已提交到 Git（如果还没）
   git add .
   git commit -m "Ready for deployment"
   ```

2. **访问 Vercel**
   - 打开 https://vercel.com
   - 使用 GitHub/GitLab/Bitbucket 账号登录

3. **导入项目**
   - 点击 "Add New Project"
   - 选择你的 Git 仓库（如果没有，先推送到 GitHub）
   - Vercel 会自动检测到 Vite 项目

4. **配置项目**
   - **Framework Preset**: Vite（自动检测）
   - **Root Directory**: `./`（默认）
   - **Build Command**: `npm run build`（自动）
   - **Output Directory**: `dist`（自动）
   - 点击 "Deploy"

5. **等待部署**
   - 通常 1-2 分钟完成
   - 部署完成后会获得一个 `*.vercel.app` 域名

6. **访问应用**
   - 点击部署完成的链接即可访问
   - 例如：`https://pick-for-me.vercel.app`

---

### 方法 2：通过 Vercel CLI 部署（命令行）

1. **安装 Vercel CLI**
   ```bash
   npm i -g vercel
   ```

2. **登录 Vercel**
   ```bash
   vercel login
   ```

3. **部署项目**
   ```bash
   cd d:\Code\Pick-For-Me
   vercel
   ```

4. **按提示操作**
   - 是否链接到现有项目？选择 `N`（首次部署）
   - 项目名称：`pick-for-me`（或自定义）
   - 是否覆盖设置？选择 `Y`
   - 等待部署完成

5. **生产环境部署**
   ```bash
   vercel --prod
   ```

---

### 方法 3：通过 Netlify 部署（备选方案）

1. **访问 Netlify**
   - 打开 https://netlify.com
   - 使用 GitHub 账号登录

2. **拖拽部署（最简单）**
   - 运行 `npm run build`
   - 将 `dist` 文件夹拖拽到 Netlify 的部署区域
   - 立即获得一个 `*.netlify.app` 域名

3. **Git 部署（推荐）**
   - 点击 "Add new site" → "Import an existing project"
   - 连接 GitHub 仓库
   - 配置：
     - **Build command**: `npm run build`
     - **Publish directory**: `dist`
   - 点击 "Deploy site"

---

## 🔧 部署配置说明

### Vercel 配置（已创建 `vercel.json`）

```json
{
  "buildCommand": "npm run build",
  "outputDirectory": "dist",
  "rewrites": [
    {
      "source": "/(.*)",
      "destination": "/index.html"
    }
  ]
}
```

**说明：**
- `rewrites`: 支持 React Router（如果需要），所有路由都指向 `index.html`
- 自动检测 Vite 配置，无需额外设置

---

## 🌐 自定义域名（可选）

### Vercel 添加自定义域名

1. 在 Vercel 项目设置中，进入 "Domains"
2. 输入你的域名（如 `pickforme.com`）
3. 按照提示配置 DNS：
   - 添加 CNAME 记录：`@` → `cname.vercel-dns.com`
   - 或添加 A 记录：指向 Vercel 提供的 IP
4. 等待 DNS 生效（通常几分钟到几小时）

---

## 📊 部署检查清单

部署前检查：
- [x] `npm run build` 成功
- [x] 构建产物在 `dist` 目录
- [x] 没有控制台错误
- [x] 所有功能正常工作

部署后检查：
- [ ] 访问部署的 URL
- [ ] 测试转盘功能
- [ ] 测试选项编辑
- [ ] 测试数据持久化（刷新页面）
- [ ] 测试拖拽排序
- [ ] 检查移动端显示

---

## 🐛 常见问题

### 1. 部署后页面空白
**原因**: 路由配置问题
**解决**: 确保 `vercel.json` 中有 `rewrites` 配置

### 2. 资源加载失败（404）
**原因**: 路径配置问题
**解决**: 检查 `vite.config.ts` 中的 `base` 配置（通常不需要修改）

### 3. 构建失败
**原因**: 依赖或构建配置问题
**解决**: 
```bash
# 本地测试构建
npm run build
# 检查 dist 目录是否正确生成
```

---

## 📈 性能优化建议

部署后可以优化：
1. **启用 Vercel Analytics**（可选）
2. **配置缓存策略**（Vercel 自动处理）
3. **启用压缩**（Vercel 自动启用 gzip/brotli）

---

## 🔄 持续部署

### 自动部署（推荐）

1. **连接 GitHub 仓库**
   - 在 Vercel 中连接你的 GitHub 仓库
   - 每次 `git push` 到 `main` 分支会自动部署

2. **预览部署**
   - 推送到其他分支会创建预览部署
   - 每个 PR 都有独立的预览链接

---

## 📝 部署信息记录

部署完成后，记录以下信息：
- **部署 URL**: `https://______.vercel.app`
- **部署时间**: `____年__月__日`
- **Git 提交**: `git commit hash`
- **自定义域名**: `______`（如有）

---

**需要帮助？** 查看 Vercel 文档：https://vercel.com/docs
