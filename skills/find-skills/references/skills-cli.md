# Skills CLI 参考

常用命令：

```bash
npx skills find <query>
npx skills add <owner/repo@skill>
npx skills check
npx skills update
```

是否全局安装、是否跳过交互确认，必须按用户明确范围决定；不要默认使用全局写入或 `-y`。
安装后检查目标路径、frontmatter、工具权限和项目兼容性。详细来源以 CLI 当前帮助和上游仓库为准。
