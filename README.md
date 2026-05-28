# Arkdle

[![版本](https://img.shields.io/badge/版本-1.3.4-blue)](CHANGELOG.md)
[![许可证](https://img.shields.io/badge/许可证-GPLv3-red)](LICENSE)

目前程序和说明性文本均使用AI生成，后续会考虑手动进行文本内容的优化。

舟兜（Arkdle）是明日方舟主题的 Wordle 式猜干员网页游戏。玩家需要在有限次数内根据职业、属性、势力等线索猜出正确干员。

## 🎮 简介

Arkdle 将经典的 Wordle 猜单词玩法移植到明日方舟领域：
- **职业**：近卫、战士、重装、辅助、医疗、术师、特殊、先锋、空崎、首领等
- **属性**：生命、攻击、防御、法抗、再部署、费用、阻挡三览
- **背景**：势力、出身地、种族，助你锁定目标干员

## ✨ 功能特性

### 核心游戏
- **每日题目模式**：每天一个固定干员，支持全球统一题目
- **随机出题模式**：自由挑战随机干员
- **兔头模式**：显示干员的详细战斗属性（生命、攻击、防御、法抗、再部署、费用、阻挡）

### 猜测反馈
- **精确匹配**：完全匹配显示绿色
- **数值近似**：属性值在可接受误差内显示黄色（如生命值相差在10%以内）
- **模糊匹配**：势力、出身地、种族属于同一父类别时显示橙色（如罗德岛相关势力）

### 视觉效果
- 猜中后播放烟花庆祝效果
- 胜利行显示特殊样式
- 支持移动端触摸拖拽浏览历史记录

### 分享功能
- 每日题目通关后可生成方格遮蔽截图
- 支持服务端渲染（Playwright）或本地渲染（html2canvas）
- 截图不包含答案，便于分享给朋友

### 数据管理
- 本地缓存猜测进度
- 服务端配置版本校验，自动清除失效缓存
- 支持账号系统（规划中）

## 📁 项目结构

```
arkdle/
├── index.html                      # 主页面入口
├── api/
│   └── server.php                  # 后端API（返回每日题目）
├── js/
│   ├── entry/
│   │   └── game_main.js            # 游戏主入口与控制器逻辑
│   ├── data/
│   │   ├── operator_data_search.js  # 干员数据搜索与管理
│   │   └── operator_name_fuzzy_search.js  # 干员名称模糊搜索
│   ├── game/
│   │   ├── role_row_component.js   # 猜测行UI组件（核心渲染）
│   │   └── guess_progress_local_cache.js  # 本地进度缓存
│   ├── ui/
│   │   ├── fuzzy_match_tooltip.js   # 模糊匹配悬浮提示
│   │   ├── approx_match_tooltip.js  # 数值近似悬浮提示
│   │   ├── content_drag.js          # 触摸拖拽支持
│   │   ├── screenshot/
│   │   │   └── daily_win_screenshot_share.js  # 截图分享功能
│   │   └── changelog_modal.js       # 更新日志弹窗
│   ├── effects/
│   │   ├── fireworks_effect.js      # 烟花/彩带效果
│   │   └── victory_ribbons_effect.js # 胜利彩带动画
│   └── tools/
│       └── html2canvas.min.js     # 截图工具库
├── style/
│   ├── main.css                  # 主样式表
│   └── fonts.css                 # 字体样式
├── resource/
│   ├── data_Operators.json        # 干员数据（核心数据源）
│   ├── data_FuzzyItem.json        # 模糊匹配词典（势力/出身地/种族父类）
│   ├── dayrandom.json             # 每日题目随机种子
│   ├── config_version.json        # 版本配置（configVersion、appVersion）
│   └── *.png / *.svg / *.ttf     # 图标与字体资源
└── server/
    └── screenshot-server.mjs        # 服务端截图服务（Playwright）
```

## 🛠️ 技术栈

### 前端
- **原生 JavaScript**（ES6+ 模块化）
- **HTML5 Canvas**（烟花效果）
- **CSS Grid/Flexbox**（响应式布局）
- html2canvas（截图渲染）

### 后端
- **PHP**（服务端API）
- **Node.js + Playwright**（服务端截图）

## 🚀 部署指南

### 环境要求
- PHP 7.4+（需支持时区设置）
- Node.js 12+（仅服务端截图需要）
- Web服务器（Apache/Nginx）

## 🔧 开发指南

### 核心架构

项目采用轻量级 MVC 架构设计：

- **Model（数据层）**：
  - `operator_data_search.js` - 管理干员数据模型
  - `guess_progress_local_cache.js` - 管理游戏状态模型

- **View（视图层）**：
  - `role_row_component.js` - 猜测行UI组件渲染
  - `fireworks_effect.js` - 视觉特效展示

- **Controller（控制层）**：
  - `game_main.js` - 处理用户输入、游戏流程控制
  - `play_controller.js`（Dev目录） - 额外控制器实现

### 数据结构

干员数据格式示例：
```json
{
  "干员名": {
    "name": "干员名",
    "englishName": "English Name",
    "rarity": "稀有度",
    "profession": "职业",
    "hp": "生命值",
    "atk": "攻击力",
    "def": "防御力",
    "res": "法抗",
    "reDeploy": "再部署时间",
    "cost": "部署费用",
    "block": "阻挡数",
    "position": "站位",
    "obtain": "获取途径",
    "Campus": "势力",
    "Origin": "出身地",
    "Race": "种族"
  }
}
```

## 📊 版本历史

当前版本：1.3.4（2026-05-28）

- v1.3.4：修正"皮洛萨"种族原型
- v1.3.3：优化次数提示与滚动体验
- v1.3.2：截图分享样式修复
- v1.3.1：新增模糊匹配与数值近似提示
- v1.3.0：新增截图分享功能
- v1.2.0：新增胜利效果与移动端适配

[查看完整更新日志](CHANGELOG.md)

## 🙏 致谢

- 明日方舟游戏数据来源于游戏内官方信息
- 本项目为非官方粉丝向游戏，所有内容版权归予鹰角网络
- 使用 GPLv3 许可证开源

## 📮 反馈

如有问题或建议，欢迎提交 Issue 或 Pull Request。