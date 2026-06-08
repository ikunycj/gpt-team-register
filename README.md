# gpt-team-register

用于自动化注册或登录 ChatGPT Team / Business 子账号的小工具。

这个仓库既可以直接当命令行脚本使用，也可以作为 Codex skill 集成到你的工作流中。核心逻辑基于 Playwright，会打开真实浏览器，自动完成 ChatGPT 登录页、SSO 选择、SAML 表单填写，以及首次登录后的常见引导步骤。

## 功能特性

- 支持通过单个账号 ID 注册或登录 Team / Business 子账号
- 自动按 `<账号ID>+@hegiw77632.cloud-ip.cc` 规则生成邮箱
- 复用持久化浏览器配置，减少重复 Cloudflare 校验
- 遇到 `invalid SAML request` 时自动重试
- 自动选择默认 onboarding 身份并跳过常见引导弹窗
- 可选择运行结束后保留浏览器，便于人工检查

## 运行要求

- Node.js
- Playwright
- 可用的 Chromium / Chrome 浏览器
- 可访问目标 Team / Business SSO 流程

脚本现在不再强依赖 macOS 固定路径。

浏览器解析顺序如下：

1. `--chrome-path`
2. 环境变量 `CHROME_PATH`
3. 环境变量 `GOOGLE_CHROME_BIN`
4. 常见系统路径自动探测
5. Playwright 默认 Chromium

Playwright 解析顺序如下：

1. 环境变量 `PLAYWRIGHT_PACKAGE_PATH`
2. 当前 Node.js 环境中的 `playwright`
3. `NODE_PATH` 中可解析的 `playwright`
4. 环境变量 `CODEX_RUNTIME_NODE_DIR` 对应运行时目录

## 快速开始

克隆仓库：

```bash
git clone git@github.com:ikunycj/gpt-team-register.git
cd gpt-team-register
```

直接运行：

```bash
./register-team-account ikun0000002
```

默认会自动生成邮箱：

```text
ikun0000002+@hegiw77632.cloud-ip.cc
```

如果浏览器出现 Cloudflare 校验，请在打开的 Chrome 窗口中手动完成，然后回到终端按回车继续。

## 作为脚本使用

最基本用法：

```bash
./register-team-account <账号ID>
```

显式指定邮箱：

```bash
./register-team-account --id ikun0000002 --email ikun0000002+@hegiw77632.cloud-ip.cc
```

运行完成后自动关闭浏览器：

```bash
./register-team-account ikun0000002 --close
```

在点击 `Sign In` 前保留人工确认：

```bash
./register-team-account ikun0000002 --confirm
```

禁用持久化浏览器配置：

```bash
./register-team-account ikun0000002 --no-persistent
```

指定首次登录角色：

```bash
./register-team-account ikun0000002 --role 产品管理
```

指定浏览器路径：

```bash
./register-team-account ikun0000002 --chrome-path /path/to/chrome
```

也可以通过环境变量指定：

```bash
CHROME_PATH=/path/to/chrome ./register-team-account ikun0000002
```

如果你的环境里 `node` 可执行文件或 `playwright` 安装位置不标准，也可以这样覆盖：

```bash
NODE_BIN=/path/to/node \
PLAYWRIGHT_PACKAGE_PATH=/path/to/node_modules/playwright/index.js \
./register-team-account ikun0000002
```

## 作为 Skill 使用

仓库中已经包含 Codex skill 定义：

- [skills/gpt-team-registration/SKILL.md](/Users/yangchunjiang/PersonalCode/closeai/gpt-team-register/skills/gpt-team-registration/SKILL.md:1)
- [skills/gpt-team-register/SKILL.md](/Users/yangchunjiang/PersonalCode/closeai/gpt-team-register/skills/gpt-team-register/SKILL.md:1)

适合的使用场景：

- 让 Codex 帮你注册新的 Team 子账号
- 在已有流程失败后让 Codex 自动重试
- 将这套注册流程纳入你自己的技能库或自动化工作流

如果你把这个仓库作为 skill 使用，推荐让 skill 继续调用仓库根目录下的 `./register-team-account`，而不是复制脚本逻辑。这样后续脚本优化后，skill 会自动继承最新行为。

## 参数说明

```text
--id <value>           账号 ID，同时作为 SSO userid
--email <value>        显式指定邮箱
--domain <value>       邮箱域名，默认：hegiw77632.cloud-ip.cc
--sso <value>          SSO 按钮名称，默认：codex
--role <value>         首次登录角色，默认：工程
--confirm              点击 Sign In 前要求人工确认
--headless             以无头模式运行 Chrome
--close                结束后自动关闭浏览器
--no-persistent        禁用持久化浏览器配置目录
--profile-dir <path>   自定义浏览器配置目录
--chrome-path <path>   指定 Chrome / Chromium 可执行文件路径
--retries <number>     SAML 过期后的重试次数
```

## 工作流程

1. 打开 `https://chatgpt.com/auth/login`
2. 检查当前是否已有登录态，必要时先退出
3. 输入目标邮箱
4. 选择指定的 SSO 提供方
5. 填写 SAML 页面中的邮箱和用户 ID
6. 提交 `Sign In`
7. 若 SAML 请求过期，则自动重新发起并重试
8. 完成首次登录后的常见引导流程

## 浏览器配置目录

默认持久化浏览器配置目录为：

```text
.browser-profile/
```

这个目录会保留一定的浏览器状态，有助于减少重复验证和重复登录。

## 注意事项

- 这个脚本更适合“可见浏览器 + 人工可接管”的使用方式
- Cloudflare、CAPTCHA 或额外安全验证仍然需要手动完成
- 当前脚本针对的是特定 Team / Business 工作区和 SSO 按钮名称
- 这不是一个通用的 OpenAI 账号注册库
- 如果你把它当 skill 用，建议 skill 只负责调用脚本，不要复制一份独立实现

## 仓库结构

```text
.
├── register-team-account
├── README.md
├── scripts/
│   └── register-team-account.mjs
└── skills/
    └── gpt-team-register/
        └── SKILL.md
```

## License

当前仓库默认为私有 / 内部使用。如需公开分发，请自行补充许可证。
