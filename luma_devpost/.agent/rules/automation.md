---
trigger: always_on
---

## 🤖 Automation with getx_clean_arch
- **New Module Creation**: NEVER create View/Controller/Binding files manually. Always use the command:
  `getxcli create:feature:<name>`
- **Dependency Management**: Use `get install <package_name>` to add new libraries to ensure proper dependency tree management.
- **Project Initialization**: If starting a new feature, use `getxcli create:feature:<name>` to maintain the GetX Pattern folder structure.
- **Workflow**: 
  1. AI proposes the module structure.
  2. AI provides the exact `getx_clean_arch` command for the user to run in the terminal.
  3. After the command creates the boilerplate, AI then populates the logic into the generated files.