/**
 * 工作室隔离预留（二期第 1 步）。一期只埋不用：所有写入注入这两个字段，查询不过滤。
 * 前端同值：src/constants/workspace.ts（WORKSPACE_DEFAULT 必须一致）。
 */
const WORKSPACE_DEFAULT = 'ws_main'
const SCHEMA_VERSION = 1

// 写入时展开进 data：{ ...WS_STAMP, ...业务字段 }
const WS_STAMP = { workspaceId: WORKSPACE_DEFAULT, schemaVersion: SCHEMA_VERSION }

module.exports = { WORKSPACE_DEFAULT, SCHEMA_VERSION, WS_STAMP }
